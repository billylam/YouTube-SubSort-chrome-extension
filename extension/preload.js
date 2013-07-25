var YTSS_PRELOAD = (function($) {
  var my = {};

  var optionsPromise = $.Deferred();
  var optionsResponse;
  var drop_watched;

  var cachePromise = $.Deferred();
  var cache, queryUrl, ids, cachedData, cache;

  // Fetch options from background script (omnibar button)
  chrome.runtime.sendMessage("show_page_action");
  chrome.runtime.sendMessage("get_options", function(response){
    optionsResponse = response;
    drop_watched = (!response["use_watched"] || response["use_watched"] == "true") ? true : false;
    optionsPromise.resolve();
  });

  // Fetch cache
  var cacheResponse;
  chrome.storage.local.get(["queryUrl","ids","cachedData","button_selection"], function(cacheResponse){
    cache = cacheResponse;
    cachePromise.resolve();
  });

  my.isOptionsFetched = function() {
    return optionsPromise.promise();
  }

  my.getOptions = function() {
    return optionsResponse;
  }

  my.getDropWatched = function() {
    return drop_watched;
  }

  my.isCacheFetched = function() {
    return cachePromise.promise();
  }

  my.getCache = function() {
    return cache;
  }

  return my;
}(jQuery));

