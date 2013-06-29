$(function() {
  var KEYS = ["AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E", "AIzaSyB2jX01dizTdoOnrImHVet8LhQxP1WIwW8"];
  var KEY = KEYS[Math.floor(Math.random()*KEYS.length)];
  var REQUEST_PENDING = false;
  var SORT_TYPE = "bestSort";
  
  // Retrive sort type from options
  chrome.runtime.sendMessage("get_options", function(response){
    SORT_TYPE = (response["use_watched"] == "true") ? bestNewSort : bestSort;
  });
  chrome.runtime.sendMessage("show_page_action");

  // Entry point
  subsort();
  register();

  // Main sorting function
  function subsort() {
    // If 'data-score' has been appended, the item has already been sorted.
    // Only sort the subset and append that to the already sorted set.
    if ($(".feed-list-item:not([data-score])").length && REQUEST_PENDING == false){
      var sortedDivs = $(".feed-list-item[data-score]");
      var newDivs = $(".feed-list-item:not([data-score])");
      var queryUrl = "https://www.googleapis.com/youtube/v3/videos?id=";
      
      $(".feed-list").css("visibility", "hidden");

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

        queryUrl += id;
        if (index != newDivs.length-1) {
          queryUrl += ",";
        }

      });
      queryUrl += "&part=statistics&key=" + KEY;


      // If our query call is exactly the same as cached call, just used cached scores
      var cachedUrl;
      chrome.storage.local.get("queryUrl", function(cache){
        cachedUrl = cache["queryUrl"];

        if (queryUrl != cachedUrl) {
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
              $.each(items, function(index, item) {
                likes = parseInt(item.statistics.likeCount);
                dislikes = parseInt(item.statistics.dislikeCount);
                // Calculate scores and append to array divs
                $(newDivs[index]).attr("data-score", wilson(likes, dislikes));
              });

              // Re-Sort, append, cache, update html
              newDivs = $(newDivs).sort(SORT_TYPE);
              var divs = $.merge($(sortedDivs), $(newDivs));
              //Only refresh the cache if we're on the first page
              if ( sortedDivs.length == 0 ) {
                chrome.storage.local.set({"queryUrl": queryUrl}, function(){});
                var cachedScores = {};
                $.each(divs, function(index, div) {
                  cachedScores[$(div).data("id")] = $(div).data("score");
                });
                chrome.storage.local.set({"cachedScores": cachedScores}, function(){});
              }
              $(".feed-list").replaceWith(divs);
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
                $(div).attr("data-score", scoresHash[$(div).data("id")]);
              });
              // Re-sort, append, update html
              newDivs = $(newDivs).sort(SORT_TYPE);
              var divs = $.merge($(sortedDivs), $(newDivs));
              $(".feed-list").replaceWith(divs);
            });
          }
        });
      }
    };

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

  });
