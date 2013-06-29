chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request == "show_page_action") {
    chrome.pageAction.show(sender.tab.id);
  }
  if (request == "get_options") {
    sendResponse({use_watched: localStorage['use_watched']});
  }
});

