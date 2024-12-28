function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('APIキー設定');
  SpreadsheetApp.getUi().showSidebar(html);
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('カスタムメニュー')
    .addItem('APIキー設定', 'showSidebar')
    .addToUi();
}

function setApiKey(apiKey) {
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("OPENAI_API_KEY", apiKey);
  return "APIキーを保存しました。";
}

function getApiKey() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var apiKey = scriptProperties.getProperty("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("APIキーが設定されていません。");
  }
  return apiKey;
}

function doGet() {
  var html = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('法令情報取得ツール')
    .setWidth(800)
    .setHeight(600);
  return html;
}

function getLawContent(lawNum, article) {
  try {
    var url = 'https://elaws.e-gov.go.jp/api/1/articles;lawNum=' + encodeURIComponent(lawNum) + ';article=' + encodeURIComponent(article);
    var response = UrlFetchApp.fetch(url);
    var xmlContent = response.getContentText();

    // API応答をログに記録
    Logger.log('API Response: ' + xmlContent);

    var xml = XmlService.parse(xmlContent);
    var root = xml.getRootElement();
    
    // XML構造に基づいて法令内容を取得
    var lawContent = getLawContentFromXML(root);
    return lawContent;
  } catch (e) {
    Logger.log('Error fetching or parsing law content: ' + e.toString());
    return '法令情報の取得中にエラーが発生しました。';
  }
}

function getLawContentFromXML(root) {
  var lawContents = root.getChild('ApplData').getChild('LawContents');
  if (!lawContents) {
    return '法令内容が見つかりません。';
  }

  var articles = lawContents.getChildren('Article');
  var lawContent = '';
  articles.forEach(function(article) {
    var paragraphs = article.getChildren('Paragraph');
    paragraphs.forEach(function(paragraph) {
      var sentences = paragraph.getChild('ParagraphSentence').getChildren('Sentence');
      sentences.forEach(function(sentence) {
        lawContent += sentence.getText() + '\n';
      });
    });
  });

  return lawContent;
}

function getLawList(category) {
  try {
    var url = 'https://elaws.e-gov.go.jp/api/1/lawlists/' + category;
    var response = UrlFetchApp.fetch(url);
    var xmlContent = response.getContentText();

    // API応答をログに記録
    Logger.log('API Response: ' + xmlContent);

    var xml = XmlService.parse(xmlContent);
    var root = xml.getRootElement();
    var applData = root.getChild('ApplData');
    
    if (!applData) {
      return []; // ApplDataが存在しない場合
    }

    var lawNameListInfo = applData.getChildren('LawNameListInfo');
    var lawData = [];

    lawNameListInfo.forEach(function(lawInfo) {
      var lawId = lawInfo.getChildText('LawId');
      var lawName = lawInfo.getChildText('LawName');
      var lawNo = lawInfo.getChildText('LawNo');
      if (lawId && lawName && lawNo) {
        lawData.push({ lawId, lawName, lawNo });
      }
    });

    return lawData;
  } catch (e) {
    Logger.log('Error fetching or parsing law list: ' + e.toString());
    return []; // エラーが発生した場合
  }
}

function processTextWithAI(text) {
  var apiKey;
  try {
    apiKey = getApiKey();
  } catch (e) {
    Logger.log("Error: " + e.message);
    return "APIキーが設定されていません。";
  }

  var data = {
    "model": "gpt-4o-mini",
    "messages": [
      { 'role': 'system', 'content': "あなたは法律のスペシャリストです..." },
      { 'role': 'user', 'content': text }
    ]
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + apiKey
    },
    "payload": JSON.stringify(data)
  };

  try {
    var response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    var result = JSON.parse(response.getContentText());
    return result.choices[0].message.content || "応答がありませんでした。";
  } catch (e) {
    Logger.log("Error: " + e.message);
    return "OpenAI APIの処理中にエラーが発生しました。";
  }
}