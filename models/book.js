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
    location: [{
        address: {
            type: String
        },
        city: {
            type: String
        },
        state: {
            type: String
        },
        lat: {
            type: Number
        },
        lng: {
            type: Number
        }
    }],
    date: {
        type: Date,
        default: Date.now
    }
});
module.exports =mongoose.model('Book',bookSchema);