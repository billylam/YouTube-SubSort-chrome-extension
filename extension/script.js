// YTSS_PRELOAD and YTSS_UTIL modules loaded by Manifest
$(function() {
  var keys = ["AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E", "AIzaSyB2jX01dizTdoOnrImHVet8LhQxP1WIwW8"];
  var key = keys[Math.floor(Math.random()*keys.length)];
  var request_pending = false;
  var ids = "";
  var drop_watched, sort_type, cache;
  
  // Entry point
  $.when(YTSS_PRELOAD.isCacheFetched(), YTSS_PRELOAD.isOptionsFetched())
    .then(function() {
        cache = YTSS_PRELOAD.getCache();
        drop_watched = YTSS_PRELOAD.getDropWatched();
      })
    .then(injectButton)
    .then(subsort)
    .then(registerLoadMoreVideos);

    
    
  // Main sorting function
  function subsort() {
    // If 'data-score' has been appended to anything, the item has already been sorted.
    // Only sort the subset and append that to the already sorted set.
    if ($(".feed-list-item:not([data-score])").length ){
      $(".feed-list").last().css("visibility", "hidden");  // This runs faster than calling on jquery var
      var unsortedDivs = $(".feed-list").last().children();

      tagMetadata(unsortedDivs);
      var queryUrl = "https://www.googleapis.com/youtube/v3/videos?id=" + ids + "&part=statistics&key=" + key;

      // If our ids are exactly the same as cached call, just used cached scores
      
      // Not cached case
      if (ids != cache["ids"]) {
        // Query YouTube via v3 api for ratings info and set state change callback
        var req = new XMLHttpRequest();
        req.open("GET", queryUrl);
        // Theoretically we shouldn't be able to 
        req.onreadystatechange = function (){
          if (this.readyState == 4 && this.status == 200) {
            tagWilsonScores(this.responseText, unsortedDivs);

            // Re-Sort, append, cache, update html
            storeCache(queryUrl, ids, unsortedDivs);
            reappend(unsortedDivs);
          }
        }
        req.send();
      }
      // Cached case, use retrieved cache
      else {
        var data = cache["cachedData"];
        $.each($(unsortedDivs), function(index, div) {
          // Append cached scores
          $(div).attr("data-score", data[$(div).data("id")][0]);
          $(div).attr("data-index", data[$(div).data("id")][1]);
        });
        reappend(unsortedDivs);
      }
    }
  };
  
  //
  // Adds the Best/New button to YouTube bar
  function injectButton() {
    $(".feed-header").prepend('<button id="videos-filter-select" class="yt-uix-button yt-uix-button-default" type="button"  data-button-menu-indicate-selected="true" role="button" aria-pressed="false" aria-expanded="false" aria-haspopup="true" aria-activedescendant="" style="float: right; margin-left: 20px; margin-bottom: 10px; min-width: 75px;"> <span class="yt-uix-button-content" id="injected-content"> </span> <img class="yt-uix-button-arrow" src="//s.ytimg.com/yts/img/pixel-vfl3z5WfW.gif" alt="" title=""><ul class=" yt-uix-button-menu yt-uix-button-menu-default" role="menu" aria-haspopup="true" style="display: none;" id="sort-select"><li role="menuitem"="aria-id-44002632540"><span class=" yt-uix-button-menu-item" id="sort-best">Best</span></li><li role="menuitem" id="aria-id-60393735063"><span class=" yt-uix-button-menu-item" id="sort-new"> New </span></li></ul></button>');
    var selection;
    if (cache["button_selection"] == "New") {
      selection = "New";
      sort_type = (drop_watched) ? YTSS_UTIL.dateNewSort : YTSS_UTIL.dateSort ;
    }
    else {
      selection = "Best";
      sort_type = (drop_watched) ? YTSS_UTIL.bestNewSort : YTSS_UTIL.bestSort ;
    }
    $("#injected-content").html(selection);
  }

  //
  // Event listeners
  //
  
  // 
  // Click on "Best" button
  $("#sort-select").on("click", "li #sort-best", function(event) {
    chrome.storage.local.set({"button_selection": "Best"}, function(){});
    sort_type  = (drop_watched) ? YTSS_UTIL.bestNewSort : YTSS_UTIL.bestSort;
    sortAllDivs();
  });

  // 
  // Click on "New" button
  $("#sort-select").on("click", "li #sort-new", function(event) {
    chrome.storage.local.set({"button_selection": "New"}, function(){});
    sort_type  = (drop_watched) ? YTSS_UTIL.dateNewSort : YTSS_UTIL.dateSort; 
    sortAllDivs();
  });
  
  function sortAllDivs() {
    var allDivsSorted = $(".feed-list-item").sort(sort_type);
    $.each($(".feed-list"), function(index, page) { 
      if (index != 0) { $(page).html('') };
      if (index != 0) { $(page).html('') };
    });
    $(".feed-list").first().html(allDivsSorted);
  }

  //
  // Register mutation observer to detect load more videos
  function registerLoadMoreVideos() {
    var target = document.querySelector(".feed-load-more-container");
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        subsort();
      });    
    });
    var config = { attributes: true, childList: true, characterData: true };
    observer.observe(target, config);
  }


  //
  //Helper Functions
  //
  
  //
  // Sorts, reappends to previously sorted divs.  Unhides list.
  function reappend(unsortedDivs) {
    unsortedDivs = $(unsortedDivs).sort(sort_type);
    $(".feed-list").last().html(unsortedDivs);
    $(".feed-list").last().css("visibility", "visible");
  }

  function storeCache(queryUrl, ids, unsortedDivs) {
    // Only cache first page
    if ( $(".feed-list").length == 1 ) {
      chrome.storage.local.set({"queryUrl": queryUrl}, function(){});
      chrome.storage.local.set({"ids": ids}, function(){});
      var cachedData = {};
      $.each($(unsortedDivs), function(index, div) {
        cachedData[$(div).data("id")] = [$(div).data("score"), $(div).data("index")];
      });
      chrome.storage.local.set({"cachedData": cachedData}, function(){});
    }
  }

  //
  // Tag metadata and set ids as a comma-separated string to cache compare
  function tagMetadata(unsortedDivs) {
    var numPrevious = $(".feed-list-item[data-score]").length;
    ids = "";
    // Parse video ids, use ids to build query url
    $.each($(unsortedDivs), function(index, div) {
      // Images are initially loaded as pixels, 'data-thumb' has actual thumbnail img src, so replace
      images = $(div).find(".yt-thumb-clip-inner img");
      $.each($(images), function(index, image) {
        $(image).attr("src", $(image).data("thumb"));
      });

      id = $(div).find('*[data-context-item-id]').data("context-item-id");
      $(div).attr("data-id", id);
      $(div).attr("data-watched", $(div).find(".watched").length);
      $(div).attr("data-index", index + numPrevious);

      ids += id;
      if (index != unsortedDivs.length-1) {
        ids += ",";
      }
    });
  }

  //
  // Parses response json response text and tags wilson score to divs
  function tagWilsonScores(json, unsortedDivs) {
    var items = JSON.parse(json).items;

    // Parse JSON response
    // Sample structure:
    // https://www.googleapis.com/youtube/v3/videos?id=au0db_NJcek,RuuIDwgmwcQ&part=statistics&key=AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E
    $.each(items, function(index, item) {
      var likes = parseInt(item.statistics.likeCount);
      var dislikes = parseInt(item.statistics.dislikeCount);
      // Calculate scores and append to array divs
      $(unsortedDivs[index]).attr("data-score", YTSS_UTIL.wilson(likes, dislikes));
    });
  }
});
