$(function() {
  var KEYS = ["AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E", "AIzaSyB2jX01dizTdoOnrImHVet8LhQxP1WIwW8"];
  var KEY = KEYS[Math.floor(Math.random()*KEYS.length)];
  var REQUEST_PENDING = false;
  var DROP_WATCHED = true;
  var SORT_TYPE;

  // Retrive sort type from options
  chrome.runtime.sendMessage("get_options", function(response){
    DROP_WATCHED = (!response["use_watched"] || response["use_watched"] == "true") ? true : false;
  });
  chrome.runtime.sendMessage("show_page_action");

  // Entry point
  injectButton();
  subsort();
  registerLoadMoreVideos();

  // Main sorting function
  function subsort() {
    // If 'data-score' has been appended to anything, the item has already been sorted.
    // Only sort the subset and append that to the already sorted set.
    if ($(".feed-list-item:not([data-score])").length && REQUEST_PENDING == false){
      $(".feed-list").last().css("visibility", "hidden");  // This runs faster than calling on jquery var
      var unsortedDivs = $(".feed-list").last().children();

      var ids = tagMetadata(unsortedDivs);
      var queryUrl = "https://www.googleapis.com/youtube/v3/videos?id=" + ids + "&part=statistics&key=" + KEY;

      // If our ids are exactly the same as cached call, just used cached scores
      chrome.storage.local.get(["queryUrl","ids","cachedData"], function(cache){
        // Not cached
        if (ids != cache["ids"]) {
          // Query YouTube via v3 api for ratings info and set state change callback
          var req = new XMLHttpRequest();
          req.open("GET", queryUrl);
          req.onreadystatechange = function (){
            if (this.readyState == 4 && this.status == 200) {
              tagWilsonScores(this.responseText, unsortedDivs);

              // Re-Sort, append, cache, update html
              storeCache(queryUrl, ids, unsortedDivs);
              REQUEST_PENDING = false;
              reappend(unsortedDivs);
            }
          }
          req.send();
          REQUEST_PENDING = true;
        }
        // Cached, use retrieved cache
        else {
          var data = cache["cachedData"];
          $.each($(unsortedDivs), function(index, div) {
            // Append cached scores
            $(div).attr("data-score", data[$(div).data("id")][0]);
            $(div).attr("data-index", data[$(div).data("id")][1]);
          });
          reappend(unsortedDivs);
        }
      });
    }
  };
  
  // Adds the Best/New button to YouTube bar
  function injectButton() {
    $(".feed-header").prepend('<button id="videos-filter-select" class="yt-uix-button yt-uix-button-default" type="button"  data-button-menu-indicate-selected="true" role="button" aria-pressed="false" aria-expanded="false" aria-haspopup="true" aria-activedescendant="" style="float: right; margin-left: 20px; margin-bottom: 10px; min-width: 75px;"> <span class="yt-uix-button-content" id="injected-content"> </span> <img class="yt-uix-button-arrow" src="//s.ytimg.com/yts/img/pixel-vfl3z5WfW.gif" alt="" title=""><ul class=" yt-uix-button-menu yt-uix-button-menu-default" role="menu" aria-haspopup="true" style="display: none;" id="sort-select"><li role="menuitem"="aria-id-44002632540"><span class=" yt-uix-button-menu-item" id="sort-best">Best</span></li><li role="menuitem" id="aria-id-60393735063"><span class=" yt-uix-button-menu-item" id="sort-new"> New </span></li></ul></button>');
    chrome.storage.local.get("button_selection", function(cache){
      var selection;
      if (cache["button_selection"] == "New") {
        selection = "New";
        SORT_TYPE = (DROP_WATCHED) ? dateNewSort : dateSort ;
      }
      else {
        selection = "Best";
        SORT_TYPE = (DROP_WATCHED) ? bestNewSort : bestSort ;
      }
      $("#injected-content").html(selection);
    });
  }

  //
  // Event listeners
  //
  
  // 
  // Click on "Best" button
  $("#sort-select").on("click", "li #sort-best", function(event) {
    chrome.storage.local.set({"button_selection": "Best"}, function(){});
    SORT_TYPE  = (DROP_WATCHED) ? bestNewSort : bestSort;
    sortAllDivs();
  });

  // 
  // Click on "New" button
  $("#sort-select").on("click", "li #sort-new", function(event) {
    chrome.storage.local.set({"button_selection": "New"}, function(){});
    SORT_TYPE  = (DROP_WATCHED) ? dateNewSort : dateSort; 
    sortAllDivs();
  });
  
  function sortAllDivs() {
    var allDivsSorted = $(".feed-list-item").sort(SORT_TYPE);
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
    unsortedDivs = $(unsortedDivs).sort(SORT_TYPE);
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
  // Tag metadata and return new ids as a comma-separated string to cache compare
  function tagMetadata(unsortedDivs) {
    var numPrevious = $(".feed-list-item[data-score]").length;
    var ids = "";
    // Parse video ids, use ids to build query url
    $.each($(unsortedDivs), function(index, div) {
      // Images are initially loaded as pixels, 'data-thumb' has actual thumbnail img src, so replace
      images = $(div).find(".yt-thumb-clip-inner img");
      $.each($(images), function(index, image) {
        $(image).attr("src", $(image).data("thumb"));
      });

      id = $(div).find(".feed-item-content-wrapper").data("context-item-id");
      $(div).attr("data-id", id);
      $(div).attr("data-watched", $(div).find(".watched").length);
      $(div).attr("data-index", index + numPrevious);

      ids += id;
      if (index != unsortedDivs.length-1) {
        ids += ",";
      }
    });
    return ids;
  }

  //
  function tagWilsonScores(json, unsortedDivs) {
    var items = JSON.parse(json).items;

    // Parse JSON response
    // Sample structure:
    // https://www.googleapis.com/youtube/v3/videos?id=au0db_NJcek,RuuIDwgmwcQ&part=statistics&key=AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E
    var likes;
    var dislikes;
    $.each(items, function(index, item) {
      likes = parseInt(item.statistics.likeCount);
      dislikes = parseInt(item.statistics.dislikeCount);
      // Calculate scores and append to array divs
      $(unsortedDivs[index]).attr("data-score", wilson(likes, dislikes));
    });
  }

  //
  // Scoring algorithm
  // http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
  //
  // Lower scores/percentages mean videos with less ratings bubble higher
  // Sample z-scores
  // 95%: 1.96
  // 90%: 1.65
  // 75%: 1.15
  //
  function wilson(likes, dislikes) {
    var totalRatings = likes + dislikes;
    var z = 1.15
    if ( totalRatings == 0 ) { 
      return 0;
    }
    var phat = 1.0 * likes / totalRatings;
    return (phat + z*z/(2*totalRatings) - z*Math.sqrt((phat*(1-phat)+z*z/(4*totalRatings))/totalRatings)) / (1+z*z/totalRatings);
  }

  //
  // Sort types
  // a and b are 'feed-list-item' divs with appended score and watched data-attributes
  //

  //
  // Sorts with Wilson confidence interval descending
  function bestSort(a, b) {
    return ( $(a).data("score") < $(b).data("score") ) ?  1 :
      ( $(a).data("score") > $(b).data("score") ) ? -1 : 0;
  }

  //
  // Sorts with watched ascending, then Wilson descending
  function bestNewSort(a, b) {
    return ( $(a).data("watched") < $(b).data("watched") ) ?  -1 : 
      ( $(a).data("watched") > $(b).data("watched") ) ?   1 :
      ( $(a).data("score")   < $(b).data("score")   ) ?   1 :
      ( $(a).data("score")   > $(b).data("score")   ) ?  -1 : 0;
  }

  //
  // Sorts with index ascending
  function dateSort(a, b) {
    return ( $(a).data("index") < $(b).data("index") ) ?  -1 :
      ( $(a).data("index") > $(b).data("index") ) ? 1 : 0;
  }

  //
  // Sorts with index ascending, then index ascending
  function dateNewSort(a, b) {
    return ( $(a).data("watched") < $(b).data("watched") ) ?  -1 : 
      ( $(a).data("watched") > $(b).data("watched") ) ?   1 :
      ( $(a).data("index") < $(b).data("index") ) ?  -1 :
      ( $(a).data("index") > $(b).data("index") ) ? 1 : 0;
  }
});
