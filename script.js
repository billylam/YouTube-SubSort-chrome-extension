$(function() {
  var KEY='AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E';

  function subsort() {
    // Array for jquery re-append
    var divs = $('.feed-list-item');
    // Ratings API Query URL
    var url = 'https://www.googleapis.com/youtube/v3/videos?id=';
    // Step 1: parse video ids and owner, use ids to build query url
    $.each($(divs), function(index, div) {
      id = $(div).find('.feed-item-content-wrapper').data('context-item-id');
      // create url array
      url += id;
      if (index != divs.length-1) {
        url += ',';
      }
      // Images are initially loaded as pixels
      // data-thumb has actual thumbnail img src - replace
      elArray = $(div).find('.yt-thumb-clip-inner img');
      $.each($(elArray), function(index, image) {
        $(image).attr('src', $(image).data('thumb'));
      });
    });
    url += '&part=statistics&key=' + KEY;

    // Step 2: Query YouTube via v3 api for ratings info and set state change callback
    var items;
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.onreadystatechange = function (){
      if (this.readyState == 4 && this.status == 200) {
        items = JSON.parse(this.responseText).items;

        // Step 3: Parse JSON response
        // Sample structure:
        // https://www.googleapis.com/youtube/v3/videos?id=au0db_NJcek,RuuIDwgmwcQ&part=statistics&key=AIzaSyDKsyHfmMxAGj89tb6JjYH6c_VF4sZNF8E
        var likes;
        var dislikes;
        $.each(items, function(i, item) {
          //for (var i = 0; i < items.length; i++) {
          likes = parseInt(item.statistics.likeCount);
          dislikes = parseInt(item.statistics.dislikeCount);
          // Step 4: Calculate scores and append to array divs
          $(divs[i]).attr('data-score', wilson(likes, dislikes));
          $(divs[i]).attr('data-watched', $(divs[i]).find('.watched').length);
        });
        // Step 5: re-sort array divs
        divs = $(divs).sort(bestSort);

        // Step 6: replace
        $('.feed-list').html(divs);
        }
      }
      req.send();
    };

    //Entry point
    subsort();
  });




  // Scoring algorithm
  // http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
  function wilson(likes, dislikes) {
    var totalRatings = likes + dislikes;
    var z = 1.96; // 95% confidence

    if ( totalRatings == 0 ) { 
      return 0;
    }

    var phat = 1.0 * likes / totalRatings;
    return (phat + z*z/(2*totalRatings) - z*Math.sqrt((phat*(1-phat)+z*z/(4*totalRatings))/totalRatings)) / (1+z*z/totalRatings);
  }

  // Sort options
  function bestSort(a, b) {
    var scoreA = $(a).data('score');
    var scoreB = $(b).data('score');

    return ( scoreA < scoreB ) ?  1 :
      ( scoreA > scoreB ) ? -1 : 0;
  }

  // a and b are 'feed-list-item's with appended score and watched data-attributes
  function bestNewSort(a, b) {
    var scoreA = $(a).data('score');
    var scoreB = $(b).data('score');
    var watchedA = $(a).data('watched');
    var watchedB = $(b).data('watched');

    // sort lower watched == 0 first
    // subsort higher score first
    return ( watchedA < watchedB ) ?  -1 : 
      ( watchedA > watchedB ) ?   1 :
      ( scoreA   < scoreB   ) ?   1 :
      ( scoreA   > scoreB   ) ?  -1 : 0;
  }
