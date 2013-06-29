// Save this script as `options.js`

// Saves options to localStorage.
function save_options() {
  var select = document.getElementById("watched");
  var dropWatched = select.children[select.selectedIndex].value;
  localStorage["watched"] = dropWatched;

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";

  setTimeout(function() {
    status.innerHTML = "";
  }, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options() {
  var dropWatched = localStorage["watched"];
  if (!dropWatched) {
    return;
  }
  var select = document.getElementById("watched");
  for (var i = 0; i < select.children.length; i++) {
    var child = select.children[i];
    if (child.value == dropWatched) {
      child.selected = "true";
      break;
    }
  }
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);
