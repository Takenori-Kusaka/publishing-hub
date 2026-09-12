---
title: Twitterの投稿をFacebookとLinkedinにも投稿されるようにしてみた
tags:
  - zapier
  - PowerAutomateDesktop
private: false
updated_at: '2021-07-04T00:09:41+09:00'
id: bceff2ab40d41c24c5da
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---
## はじめに

本記事は各SNSに同じような投稿をしたいのに、一々各サイトをめぐってコピペするのがアホくさかったので、自動化できないかと試みた結果をまとめたものです
よりベストな方法があろうことは想像に難くないですが、見つけられなかったので備忘録的に残しておきます
また、新規開発要素はありませんので、外部リンクばかりです
Power Automate Desktopを実行するためのPCが別途必要なので、汎用性および実用性は薄いです
有料版であればO365のPower Automateと繋げてできそうなことを無理やりやっているのでおすすめできません

## まとめ

![SyncSNS.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/262854/4804ae9f-c05a-9011-01b8-bf212fd815fa.png)

1. Twitterの投稿をzapierで拾ってメールへ転送する
2. 特定の未読メールを周期的にPower Automate Desktopでポーリング取得する
3. メールの本文をPower Automate Desktopでクリップボードへ保存
4. Facebook/LinkedinをChromeで開く
5. Power Automate DesktopのWebUI操作を実行し、投稿する

## 1. Twitterの投稿をzapierで拾ってメールへ転送する

### Twitterの自分の投稿をzapierで取得する

こちらを参考にしました
[TwitterからSlackに投稿するには？Zapierで簡単！
](https://mag.sweeep.ai/topic/80871/)

### Twitterで取得した結果をGmailへ送信する

こちらを参考にしました
[Slackとzapierを使ってメール送信を自動化してみた
](https://mag.sweeep.ai/topic/80871/)

## 2. 特定の未読メールを周期的にPower Automate Desktopでポーリング取得する

### 特定の未読メールを取得する

こちらを参考にしました
[![Power Automate Desktop : How to work with "Retrieve Emails" Action (Email Automation)](https://img.youtube.com/vi/QQgeT9eNbE8/0.jpg)](https://www.youtube.com/watch?v=QQgeT9eNbE8)

### ポーリングする

こちらを参考にしました
[Power Automate Desktop：無料バージョンだけで定期的にフローを自動実行する方法（アイデア）
](https://cravelweb.com/rpa/power-automate-desktop/how-to-run-scheduled-flow-on-power-automate-desktop-for-free)

## 3. メールの本文をPower Automate Desktopでクリップボードへ保存

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/262854/d3717a86-7820-c5c7-757e-c5530c92ddd7.png)

```Robin
Clipboard.SetText Text: PostText
MouseAndKeyboard.SendKeys TextToSend: $'''{Control}({V})''' DelayBetweenKeystrokes: 10 SendTextAsHardwareKeys: True
```

キー入力によるショートカットキー利用はこちらを参考にしました
[ドキュメント Power Platform Power Automate Power Automate Desktop デスクトップ アクションのリファレンス マウスとキーボード](https://docs.microsoft.com/ja-jp/power-automate/desktop-flows/actions-reference/mouseandkeyboard)

PostTextはMailObject.Bodytextが入ります

## 4. Facebook/LinkedinをChromeで開く

例: Linkedinの場合

```Robin
System.RunApplication ApplicationPath: $'''\"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe\"''' CommandLineArguments: $'''https://www.linkedin.com/feed/''' WindowStyle: System.ProcessWindowStyle.Normal ProcessId=> AppProcessId
WebAutomation.AttachToChromeByUrl TabUrl: $'''https://www.linkedin.com/feed/''' BrowserInstance=> Browser
WAIT (UIAutomation.Windows.ToOpenByTitleClass Title: $'''フィード | LinkedIn - Google Chrome''' Class: $'''Chrome_WidgetWin_1''' FocusWindow: True) 
```

chrome.exeのパスは環境変数なりに入れるとか変数で渡せるようにするとか工夫したほうが良さそうだけど、個人利用だしいっかの精神
2行目のWebAutomation.AttachToChromeByUrlでWeb操作可能なオブジェクトを取得するため必須
3行目はWindowが立ち上がってないと操作に移れないための待機。オプションでフォーカスを合わせることもできるので、設定しておく
※バックグラウンド実行できるのであればしたいが、試行錯誤コスト高そうだったので今回は保留

環境によって、各行実行時にまだページが開いてないとか、色々あると思うので、waitをうまく挟んだほうが良さげ

## 5. Power Automate DesktopのWebUI操作を実行し、投稿する

Webレコーダーを使用してやりたい操作を登録した
レコーダーを使わずにUIの要素をポチポチ拾ってあげようとすると、一時トークンも含む限定的なオブジェクトと認識されてしまい再利用できなかった
セレクターの編集から頑張ればできるっぽいけど、ハマりそうだったのでレコーダーで進めた

Webレコーダーの利用方法についてはこちらを参考にしました
[【初心者向け】Microsoft RPA Power Automate Desktop はじめてのWebレコーダー](https://trendlife.co.jp/rpa-powerautomatedesktop-biginner02/)

## 成果物イメージ
![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/262854/8505db84-d57a-d98e-2c13-90fca662f48d.png)

## できなかったこと、わからなかったこと、やりたいこと

次の機会に向けた自分へのまとめ。コメントもらえるとありがたいところ。

### できなかったこと

* クラス、関数分けのようにフローを分けて呼び出す
* Chromeインスタンスの再利用
* 投稿入力フォームへの直接入力(クリップボードを使わない)

### わからなかったこと

* UI要素のセレクターの書き方、作り方
* バックグラウンド実行

### やりたいこと

* Pythonなどを用いてSaaS APIを呼び出す処理との連動
* 仕事で、UIを含むアプリケーションのテスト自動化
