window.onload = function() {
    // Check if there are errors
    var errors = document.getElementById('errorMessage')
    if (errors.textContent.length > 32) {
      console.log(errors.textContent.length)
      showError();
    }
  };
  
  // Function to display the modal with the error message
  function showError() {
    var modal = document.getElementById('errorModal');
    modal.style.display = 'block';
  }
  
  
  // When the user clicks on <span> (x), close the modal
 function closeModal() {
    var modal = document.getElementById('errorModal');
    
    modal.style.display = 'none';
  }
  
  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
    var modal = document.getElementById('errorModal');
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  }