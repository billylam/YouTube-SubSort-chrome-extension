// Saves options to localStorage.
function save_options() {
  var select = document.getElementById("use_watched");
  var dropWatched = select.children[select.selectedIndex].value;
  localStorage["use_watched"] = dropWatched;
}

// Restores select box state to saved value from localStorage.
function restore_options() {
  var dropWatched = localStorage["use_watched"];
  if (!dropWatched) {
    return;
  }
  var select = document.getElementById("use_watched");
  for (var i = 0; i < select.children.length; i++) {
    var child = select.children[i];
    if (child.value == dropWatched) {
      child.selected = "true";
      break;
    }
  }
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#use_watched').addEventListener('change', save_options);
