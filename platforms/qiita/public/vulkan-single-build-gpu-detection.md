---
title: GPU推論を「単一インストーラ」で配る：Vulkanを遅延ロードし、起動時にデバイスを数えてからGPUを使う
tags:
  - Rust
  - Vulkan
  - Tauri
  - Windows
private: true
updated_at: '2026-09-22T23:57:02+09:00'
id: f263a02659c93afa1a7c
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

ローカルで音声文字起こしをするデスクトップアプリで、16分42秒の録音に CPU で196分かかっていました。GPU に載せれば6分台に落ちます。問題は配布でした。**GPU のあるマシンと無いマシンに、同じインストーラを1つ配りたい。**

この記事は、Vulkan を使いながら DLL を同梱せず、GPU が無い環境でも起動する形に落ち着いた実装の記録です。「GPU を試して失敗したら CPU に落とす」という素直な方法が**使えなかった**理由から書きます。

- 正本（Zenn Books『ローカル完結ボイスジャーナルの設計』）: [GPU と Vulkan の章を読む](https://zenn.dev/takenori_kusaka/books/quickscribe-design/viewer/speed-floor-gpu-vulkan)
- 実装（OSS）: [Takenori-Kusaka/QuickScribe](https://github.com/Takenori-Kusaka/QuickScribe)

## 実測：CPU、CUDA、Vulkan

同じ16分42秒の録音を、RTX 4060 の実機で比べた結果です。RTF は処理時間 / 音声長で、1.0 が実時間と同じ速さです。

| 実行 | 処理時間 | RTF | 配布の条件 |
|---|---|---|---|
| CPU（Ryzen 7 3700X） | 196.3分 | 11.7 | なし |
| GPU（CUDA） | 5.48分 | 0.33 | NVIDIA 専用・DLL 同梱・ドライバ版の下限あり |
| **GPU（Vulkan）** | **6.10分** | **0.364** | ベンダー横断・DLL 同梱なし |

**CUDA と Vulkan の差は約11%**でした。この11%のために、NVIDIA 専用ビルドを別に用意し、ランタイム DLL を同梱し、ドライバ版の下限を利用者に説明する価値があるか。ないと判断しました。CUDA 変種はその後、完全に廃止しています。

ひとつ癖があります。Vulkan は初回にシェーダを実行時コンパイルするため、短い音声だと固定費が支配的で RTF が悪化します。60秒だけ切って測ると RTF は6近くになり、遅く見えます。**数分以上の録音では償却されて 0.364 になる**ので、ベンチの音声長で結論が変わる典型例です。

## 技術選定：なぜ「試して失敗したらCPU」ができないのか

最初に考えたのは、素直な実行時フォールバックでした。GPU で初期化して、失敗したら CPU でやり直す。書けません。理由はコードのコメントに残してあります。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/lib.rs
/// Vulkan の物理デバイスが1台以上あるか（起動時の環境認識フェーズで安全に判定 / ADR-0027 Phase3）。
///
/// 重要: whisper.cpp の GPU 初期化は、使えるデバイスが無い状態で呼ぶと **C++ 例外で abort** し、
/// Rust 側では捕捉できない（実測: `Rust cannot catch foreign exceptions` / STATUS_STACK_BUFFER_OVERRUN）。
/// つまり「GPUを試して失敗したらCPUへ」という実行時フォールバックは**原理的に不可能**。
/// よって GPU を使う *前* に、Vulkan ローダの安全な C API（vkCreateInstance + vkEnumeratePhysicalDevices・
/// 戻り値は VkResult で例外を投げない）で物理デバイス数を数え、**1台以上ある時だけ** GPU を使う。
/// vulkan-1.dll 不在 / ICD(ドライバ)不在 / インスタンス生成失敗 / デバイス0 はすべて false（=CPU実行）。
/// DLL の存在だけでは不十分（ローダは GPU 無しでも在ることがある）。
```

C++ 側が `abort` するので、Rust の `catch_unwind` では拾えません。**失敗を捕まえられないなら、失敗する前に確かめるしかない。** そこで、例外を投げない Vulkan の C API だけを使ってデバイスを数えます。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/lib.rs
#[cfg(all(windows, feature = "vulkan"))]
fn vulkan_device_present() -> bool {
    use ash::vk;
    // すべて Vulkan ローダの C API 呼び出し（unsafe だが VkResult を返し例外は投げない）。
    unsafe {
        // Entry::load は libloading で vulkan-1.dll を実行時に開く（不在なら Err → false）。
        let entry = match ash::Entry::load() {
            Ok(e) => e,
            Err(_) => return false,
        };
        let app_info = vk::ApplicationInfo::default().api_version(vk::API_VERSION_1_0);
        let create_info = vk::InstanceCreateInfo::default().application_info(&app_info);
        // ICD/ドライバ不在や壊れたローダはここで Err（例外ではなく VkResult）→ false。
        let instance = match entry.create_instance(&create_info, None) {
            Ok(i) => i,
            Err(_) => return false,
        };
        let present = matches!(instance.enumerate_physical_devices(), Ok(d) if !d.is_empty());
        instance.destroy_instance(None);
        present
    }
}
```

コピペするなら、注目してほしいのは判定の段数です。`ash::Entry::load()` で**ローダの存在**、`create_instance` で**ドライバ（ICD）の存在**、`enumerate_physical_devices` で**デバイスの存在**を、それぞれ別に確かめています。`vulkan-1.dll` があるかどうかだけを見る実装は不十分です。ローダは GPU が無いマシンにも入っていることがあり、その場合デバイスは0台です。

呼び出し側は、この結果と利用者の設定を合わせて1つの真偽値にします。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/lib.rs
pub fn gpu_backend_available() -> bool {
    #[cfg(all(windows, feature = "vulkan"))]
    {
        return vulkan_device_present();
    }
    #[allow(unreachable_code)]
    false
}
```

CPU ビルドと非 Windows では常に `false` を返します。**GPU が使えないと判定したときは、GPU の API を一度も呼びません。** 呼ばなければ abort しません。

## 起動できないアプリを作らないために：遅延ロード

ここでもう1つ壁があります。Vulkan を有効にしてビルドすれば、`vulkan-1.dll` が**静的インポート**として紐づきます。静的インポートの解決は EXE の起動時です。ローダの入っていないマシンでは**アプリが起動すらしません**。デバイス数を数えるコードへ到達する前に落ちます。

解決は Windows のリンカオプション1行でした。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/build.rs
        // Vulkan変種(ADR-0028): whisper-rs-sys が vulkan-1.dll を静的インポートするため、
        // ローダ未導入(GPUドライバ無しの最小Windows)ではEXEが起動時解決に失敗して起動不能になる。
        // 遅延ロードにすれば解決は最初のVulkan呼び出し時に延び、GPU無し機でも起動できる
        // (起動時の vulkan_device_present()=ash動的ロードでデバイス0を検出→use_gpu=false=Vulkan API不使用。
        //  デバイス有りの時だけGPU経路に入り、その時は vulkan-1.dll が在るので遅延解決が成功する)。
        if std::env::var("CARGO_FEATURE_VULKAN").is_ok() {
            println!("cargo::rustc-link-arg=/DELAYLOAD:vulkan-1.dll");
        }
```

`/DELAYLOAD` を付けると、DLL の解決が最初の呼び出しまで遅れます。デバイスが0台の環境では Vulkan の関数を一度も呼ばないので、**解決が発生しないまま CPU で動きます**。DLL を同梱せずに単一のインストーラで配れているのは、同梱ではなくこの遅延ロードのおかげです。

ビルド側の指定はフィーチャー1つです。

```toml
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/Cargo.toml
[features]
# GPU(Vulkan)ビルド変種(ADR-0028)。ベンダー横断(NVIDIA/AMD/Intel)・DLL同梱不要・
# Vulkan対応ドライバのみ。ビルドに VULKAN_SDK が必要。既定リリースはこの変種で単一配布する。
# 起動時にVulkan実デバイスを列挙(ash)し、有る時だけGPUを使う=whisperのGPU初期化abortを回避。
vulkan = ["whisper-rs/vulkan", "dep:ash"]
```

## CI：SDK の版は固定する

ビルドには [Vulkan SDK](https://sdk.lunarg.com/) が必要です。CI では版を固定してサイレントインストールしています。

```yaml
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/.github/workflows/release.yml
      - name: Install Vulkan SDK (windows-x64 default Vulkan build)
        if: matrix.label == 'windows-x64'
        shell: pwsh
        run: |
          # 既知良好版にピン留め(ADR-0012 決定的ビルド / LunarGの破壊的更新でリリースが赤化するのを防ぐ)。
          # 更新は明示的なPRで(実機Vulkan動作を確認のうえ版を上げる)。test-build.yml と同版を維持。
          $ver = "1.4.350.0"
          Write-Host "Vulkan SDK version (pinned): $ver"
          $url = "https://sdk.lunarg.com/sdk/download/$ver/windows/vulkansdk-windows-X64-$ver.exe"
          $exe = "$env:RUNNER_TEMP\vulkan-sdk-installer.exe"
          Invoke-WebRequest -Uri $url -OutFile $exe
          Start-Process -FilePath $exe -ArgumentList "--accept-licenses","--default-answer","--confirm-command","install" -Wait
          $sdk = "C:\VulkanSDK\$ver"
          if (-not (Test-Path $sdk)) { throw "Vulkan SDK not found at $sdk" }
          "VULKAN_SDK=$sdk" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
          "$sdk\Bin" | Out-File -FilePath $env:GITHUB_PATH -Append -Encoding utf8
```

版を固定しているのは、SDK 側の更新でリリースが落ちるのを避けるためです。更新は明示的な PR で行い、実機で Vulkan が動くことを確かめてから上げます。**インストーラが指定パスに現れなかったら `throw` して止める**のも意図的で、SDK が入らないまま「CPU ビルドが出来上がった」という事故を防いでいます。

## 残っている弱点

3つあります。

1つ目は、**この判定を試せる環境が限られる**ことです。統合テストでデバイス0台のときに安全に `false` を返すことは確かめていますが、実際の GPU の組み合わせ（AMD、Intel、古いドライバ）は手元にありません。ベンダー横断を選んだのに、検証は1台の NVIDIA だけです。

2つ目は、シェーダの実行時コンパイルの固定費です。短い録音では RTF が悪化します。パイプラインキャッシュで軽くできる余地がありますが、まだ手を付けていません。

3つ目は、GPU の判定が起動時の1回だけであることです。外付け GPU の着脱のような、実行中の変化には追随しません。
