function addToQueue(id) {
    $.ajax({
        url: `/api/addToPlaylist/${id}`, // Endpoint URL
        method: 'GET', // Or 'POST' if you used app.post() on the server
        success: function(response) {
            console.log('Server function executed:', response);
            // Handle the response from the server
        },
        error: function(err) {
            console.error('Error calling server function:', err);
        }
    });
}