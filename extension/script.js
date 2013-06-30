$(function() {
  var KEYS = ["AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E", "AIzaSyB2jX01dizTdoOnrImHVet8LhQxP1WIwW8"];
  var KEY = KEYS[Math.floor(Math.random()*KEYS.length)];
  var REQUEST_PENDING = false;
  var IS_USING_WATCHED = true;
  var SORT_TYPE = "bestNewSort";
  
  // Retrive sort type from options
  chrome.runtime.sendMessage("get_options", function(response){
    IS_USING_WATCHED = (!response["use_watched"] || response["use_watched"] == "true") ? true : false;
    SORT_TYPE = (!response["use_watched"] || response["use_watched"] == "true") ? bestNewSort : bestSort;
  });
  chrome.runtime.sendMessage("show_page_action");

  // Entry point
  inject();
  subsort();
  register();

  // Main sorting function
  function subsort() {
    // If 'data-score' has been appended, the item has already been sorted.
    // Only sort the subset and append that to the already sorted set.
    if ($(".feed-list-item:not([data-score])").length && REQUEST_PENDING == false){
      var newDivs = $(".feed-list").last().children();
      var queryUrl = "https://www.googleapis.com/youtube/v3/videos?id=";
      // String concat is faster than join in Chrome.
      var ids = "";
      
      var newPage = $(".feed-list").last();
      // Calling this directly rather than using var newPage hides faster...
      $(".feed-list").last().css("visibility", "hidden");

      // Parse video ids, use ids to build query url
      $.each($(newDivs), function(index, div) {
        // Images are initially loaded as pixels, 'data-thumb' has actual thumbnail img src, so replace
        images = $(div).find(".yt-thumb-clip-inner img");
        $.each($(images), function(index, image) {
          $(image).attr("src", $(image).data("thumb"));
        });

        id = $(div).find(".feed-item-content-wrapper").data("context-item-id");
        $(div).attr("data-id", id);

        $(div).attr("data-watched", $(div).find(".watched").length);

        ids += id;
        if (index != newDivs.length-1) {
          ids += ",";
        }

      });
      queryUrl += ids + "&part=statistics&key=" + KEY;


      // If our query call is exactly the same as cached call, just used cached scores
      var cachedUrl;
      chrome.storage.local.get(["queryUrl","ids"], function(cache){
        cachedUrl = cache["queryUrl"];
        cachedIds = cache["ids"];

        if (ids != cachedIds) {
          // Query YouTube via v3 api for ratings info and set state change callback
          var items;
          var req = new XMLHttpRequest();
          req.open("GET", queryUrl);
          req.onreadystatechange = function (){
            if (this.readyState == 4 && this.status == 200) {
              items = JSON.parse(this.responseText).items;

              // Parse JSON response
              // Sample structure:
              // https://www.googleapis.com/youtube/v3/videos?id=au0db_NJcek,RuuIDwgmwcQ&part=statistics&key=AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E
              var likes;
              var dislikes;
              var previous = $(".feed-list-item[data-score]")
              $.each(items, function(index, item) {
                likes = parseInt(item.statistics.likeCount);
                dislikes = parseInt(item.statistics.dislikeCount);
                // Calculate scores and append to array divs
                $(newDivs[index]).attr("data-score", wilson(likes, dislikes));
                $(newDivs[index]).attr("data-index", index + previous.length);
              });

              // Re-Sort, append, cache, update html
              newDivs = $(newDivs).sort(SORT_TYPE);
              //Only refresh the cache if we're on the first page
              if ( $(".feed-list").length == 1 ) {
                chrome.storage.local.set({"queryUrl": queryUrl}, function(){});
                chrome.storage.local.set({"ids": ids}, function(){});
                var cachedScores = {};
                $.each(newDivs, function(index, div) {
                  cachedScores[$(div).data("id")] = [$(div).data("score"), $(div).data("index")];
                });
                chrome.storage.local.set({"cachedScores": cachedScores}, function(){});
              }
              $(newPage).html(newDivs);
              $(newPage).css("visibility", "visible");
              REQUEST_PENDING = false;
              }
              
            }
            req.send();
            REQUEST_PENDING = true;
          }
          else {
            // Retrieve local cache
            chrome.storage.local.get("cachedScores", function(cache){
              var scoresHash = cache["cachedScores"];
              $.each($(newDivs), function(index, div) {
                // Append cached scores
                $(div).attr("data-score", scoresHash[$(div).data("id")][0]);
                $(div).attr("data-index", scoresHash[$(div).data("id")][1]);
              });
              // Re-sort, append, update html
              newDivs = $(newDivs).sort(SORT_TYPE);
              $(newPage).html(newDivs);
              $(newPage).css("visibility", "visible");
            });
          }
        });
      }
    };
    
    function inject() {
      $(".feed-header").prepend('<button id="videos-filter-select" class="yt-uix-button yt-uix-button-default" type="button"  data-button-menu-indicate-selected="true" role="button" aria-pressed="false" aria-expanded="false" aria-haspopup="true" aria-activedescendant="" style="float: right; margin-left: 20px; margin-bottom: 10px; min-width: 75px;"> <span class="yt-uix-button-content" id="injected-content"> Best </span> <img class="yt-uix-button-arrow" src="//s.ytimg.com/yts/img/pixel-vfl3z5WfW.gif" alt="" title=""><ul class=" yt-uix-button-menu yt-uix-button-menu-default" role="menu" aria-haspopup="true" style="display: none;" id="sort-select"><li role="menuitem"="aria-id-44002632540"><span class=" yt-uix-button-menu-item" id="sort-best">Best</span></li><li role="menuitem" id="aria-id-60393735063"><span class=" yt-uix-button-menu-item" id="sort-new"> New </span></li></ul></button>');
    }
    
    $("#sort-select").on("click", "li #sort-best", function(event) {
      DEFAULT_BEHAVIOR = "Best";
      var divs = $(".feed-list-item").sort(SORT_TYPE);
      $.each($(".feed-list"), function(index, page) { 
        if (index != 0) { $(page).html('') };
      });
      $(".feed-list").first().html(divs);
    });
 
    $("#sort-select").on("click", "li #sort-new", function(event) {
      DEFAULT_BEHAVIOR = "New";
      var divs = $(".feed-list-item");
      divs = (IS_USING_WATCHED) ? divs.sort(dateNewSort) : divs.sort(dateSort); 
      
      $.each($(".feed-list"), function(index, page) { 
        if (index != 0) { $(page).html('') };
      });
      $(".feed-list").first().html(divs);
    });

    //
    //Helper Functions
    //

    //
    // Register mutation observer
    function register() {
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
    // Sort options
    // a and b are 'feed-list-item' divs with appended score and watched data-attributes
    //

    //
    // Sorts with Wilson confidence interval
    function bestSort(a, b) {
      var scoreA = $(a).data("score");
      var scoreB = $(b).data("score");

      return ( scoreA < scoreB ) ?  1 :
        ( scoreA > scoreB ) ? -1 : 0;
    }

    //
    // Sorts with Wilson confidence interval and pushes watched videos to end
    function bestNewSort(a, b) {
      var scoreA = $(a).data("score");
      var scoreB = $(b).data("score");
      var watchedA = $(a).data("watched");
      var watchedB = $(b).data("watched");

      return ( watchedA < watchedB ) ?  -1 : 
        ( watchedA > watchedB ) ?   1 :
        ( scoreA   < scoreB   ) ?   1 :
        ( scoreA   > scoreB   ) ?  -1 : 0;
    }
    
      function dateSort(a, b) {
        var indexA = $(a).data("index");
        var indexB = $(b).data("index");
     
        return ( indexA < indexB ) ?  -1 :
          ( indexA > indexB ) ? 1 : 0;
      }
     
      function dateNewSort(a, b) {
        var indexA = $(a).data("index");
        var indexB = $(b).data("index");
        var watchedA = $(a).data("watched");
        var watchedB = $(b).data("watched");
     
        return ( watchedA < watchedB ) ?  -1 : 
          ( watchedA > watchedB ) ?   1 :
          ( indexA < indexB ) ?  -1 :
          ( indexA > indexB ) ? 1 : 0;
      }
  });
