$(document).ready(function(){
    var socket = io();
    // connect client to server
    socket.on('connect',function(socket){
        console.log('Connected to Server');
    });
    //emit user ID
    var ObjectID = $('#ObjectID').val();
    var bookID = $('#bookID').val();
    socket.emit('ObjectID',{
        bookID: bookID,
        userID: ObjectID
    });
    //listen to book event
    socket.on('book',function(book){
        console.log(book);
        //ajax request: fetch latitude and longitude
        $.ajax({
            url:`https://maps.googleapis.com/maps/api/geocode/json?address=${book.location}&key=AIzaSyB_IkcXKFgm_8Lw0QSRJblZxiNjDYfpxqc`,
            type: 'POST',
            data: JSON,
            processData: true,
            success: function(data){
                console.log(data);
                //send lat and long to server
                socket.emit('LatLng',{
                    data: data,
                    book: book
                });
            }
        });
    });
    
    //disconnect from server
    socket.on('disconnect',function(socket){
        console.log('Disconnected from server');
    });
});