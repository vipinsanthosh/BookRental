const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bookSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    title: {
        type: String
    },
    author: {
        type: String
    },
    edition: {
        type: String
    },
    type: {
        type: String
    },
    pricePerWeek: {
        type: Number
    },
    pricePerMonth: {
        type: Number
    },
    
    image: [{
        imageUrl: {
            type: String
        }
    }],

    location: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    },
    coords: {
        lat: {
            type: Number
        },
        lng: {
            type: Number
        }
        
    },
    picture: {
        type: String
    }

});
module.exports = mongoose.model('Book',bookSchema);