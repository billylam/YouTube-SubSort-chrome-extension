var YTSS_UTIL = (function($) {
  var my = {};
  
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
  my.wilson = function(likes, dislikes) {
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
  my.bestSort = function(a, b) {
    return ( $(a).data("score") < $(b).data("score") ) ?  1 :
      ( $(a).data("score") > $(b).data("score") ) ? -1 : 0;
  }

  //
  // Sorts with watched ascending, then Wilson descending
  my.bestNewSort = function(a, b) {
    return ( $(a).data("watched") < $(b).data("watched") ) ?  -1 : 
      ( $(a).data("watched") > $(b).data("watched") ) ?   1 :
      ( $(a).data("score")   < $(b).data("score")   ) ?   1 :
      ( $(a).data("score")   > $(b).data("score")   ) ?  -1 : 0;
  }

  //
  // Sorts with index ascending
  my.dateSort = function(a, b) {
    return ( $(a).data("index") < $(b).data("index") ) ?  -1 :
      ( $(a).data("index") > $(b).data("index") ) ? 1 : 0;
  }

  //
  // Sorts with index ascending, then index ascending
  my.dateNewSort = function(a, b) {
    return ( $(a).data("watched") < $(b).data("watched") ) ?  -1 : 
      ( $(a).data("watched") > $(b).data("watched") ) ?   1 :
      ( $(a).data("index") < $(b).data("index") ) ?  -1 :
      ( $(a).data("index") > $(b).data("index") ) ? 1 : 0;
  }
  
  return my;
}(jQuery));