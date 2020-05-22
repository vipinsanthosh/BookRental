//load modules
const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const bcryt = require('bcryptjs');
const Handlebars = require('handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');
const formidable = require('formidable');
const socketIO = require('socket.io');
const http = require('http');
//init app
const app = express();
//setup body parser middleware
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
//config for authentication
app.use(cookieParser());
app.use(session({
    secret: 'mysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
//load helpers
const {requireLogin,ensureGuest} = require('./helpers/authHelper');
const {upload} = require('./helpers/aws');

//load passports
require('./passport/local');
require('./passport/facebook');
//make user a global object
app.use((req,res,next) =>{
    res.locals.user = req.user || null;
    next();
});
//load Files
const keys = require('./config/keys');
//load Stripe
const stripe = require('stripe')(keys.StripeSecretKey);
//load connection
const User = require('./models/user');
const Contact = require('./models/contact');
const Book = require('./models/book');
const Chat = require('./models/chat');
const Budget = require('./models/budget');
//connect to MongoDB
mongoose.connect(keys.MongoDB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, ()=> {
    console.log('MonogoDB is connected...');
}).catch((err)=>{
    console.log(err);
});
//setup view engine
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine','handlebars');
//connect clint side to server css and js files
app.use(express.static('public'));
//create port
const port = process.env.PORT || 3000;
//handle home route
app.get('/',ensureGuest,(req,res) => {
    res.render('home');
});
app.get('/about',ensureGuest,(req,res) =>{
    res.render('about',{
        title: 'About'
    });
});
app.get('/contact',requireLogin,(req,res) =>{
    res.render('contact',{
        title: 'Contact us'
    });
});
//save contact form data
app.post('/contact',(req,res)=> {
    console.log(req.body);
    const newContact = {
        name: req.user._id,
        message: req.body.message
    }
    new Contact(newContact).save((err,user)=> {
        if(err) {
            throw err;
        }else{
            console.log('MESSAGE RECEIVED',user);
        }
    });
});
app.get('/signup',ensureGuest,(req,res) =>{
    res.render('signupForm',{
        title: 'Register'
    });
});
app.post('/signup',(req,res) => {
    console.log(req.body);
    let errors = [];
    if(req.body.password !== req.body.password2){
        errors.push({text:'Password doesnot match'});
    }
    if (req.body.password.length < 4){
        errors.push({text:'Password must be atleast 4 characters!'});
    }
    if (errors.length > 0){
        res.render('signupForm',{
            errors:errors,
            firstname:req.body.firstname,
            lastname:req.body.lastname,
            email: req.body.email
        })
    }else{
        User.findOne({email:req.body.email})
        .then((user) =>{
            if (user) {
                let errors = [];
                errors.push({text:'Email already exists!'});
                res.render('signupForm',{
                    errors:errors,
                    firstname:req.body.firstname,
                    lastname:req.body.lastname,
                    password:req.body.password,
                    password2:req.body.password2,

                });
            }else{
                //encrypt password
                let salt = bcryt.genSaltSync(10);
                let hash = bcryt.hashSync(req.body.password,salt);
                const newUser = {
                    firstname:req.body.firstname,
                    lastname:req.body.lastname,
                    email: req.body.email,
                    password:hash
                }
                new User(newUser).save((err,user) => {
                    if (err) {
                        throw err;
                    }
                    if (user) {
                        let success =[];
                        success.push({text:'Account Created'});
                        res.render('loginForm',{
                            success:success
                        })
                    }
                })
            }
        })
    }
});
app.get('/displayLoginForm',ensureGuest,(req,res) =>{
    res.render('loginForm');
});
//passport authentication
app.post('/login',passport.authenticate('local',{
    successRedirect: '/profile',
    failureRedirect: '/loginErrors'
}));
app.get('/auth/facebook',passport.authenticate('facebook',{
    scope: ['email']
}));
app.get('/auth/facebook/callback',passport.authenticate('facebook',{
    successRedirect:'/profile',
    failureRedirect: '/'
}));
//display profile
app.get('/profile', requireLogin , (req,res)=>{
    User.findById({_id:req.user._id})
    .then((user)=>{
        user.online = true;
        user.save((err,user)=>{
            if (err){
                throw err;
            }
            if (user){
                res.render('profile',{
                    user:user,
                    title:'Profile'
                });
            }
        })
    });
});
app.get('/loginErrors',(req,res)=>{
    let errors = [];
    errors.push({text:'Email or Password Incorrect'});
    res.render('loginForm',{
        errors:errors,
        title:'Error'
    });
});
//list a book
app.get('/listBook',requireLogin,(req,res)=>{
    res.render('listBook',{
        title:'Listing'
    })
});
app.post('/listBook',requireLogin,(req,res)=>{
    const newBook = {
        owner: req.user._id,
        title: req.body.title,
        author: req.body.author,
        edition: req.body.edition,
        type: req.body.type
    }
    new Book(newBook).save((err,book)=> {
        if(err) {
            throw err;
        }
        if(book){
            res.render('listBook2',{
                title:'Finish',
                book:book
            });
        }
    })
    
});

app.post('/listBook2',requireLogin,(req,res)=>{
    Book.findOne({_id:req.body.bookID,owner:req.user._id})
    .then((book) =>{
        let imageUrl = {
            imageUrl: `https://book-rental-project.s3.ap-south-1.amazonaws.com/${req.body.image}`
        };
        book.pricePerWeek = req.body.pricePerWeek;
        book.pricePerMonth = req.body.pricePerMonth;
        book.location = req.body.location;
        book.picture = `https://book-rental-project.s3.ap-south-1.amazonaws.com/${req.body.image}`;
        book.image.push(imageUrl); 
        book.save((err,book)=> {
            if(err){
                throw err;
            }
            if (book){
                res.redirect('/showBooks');
            }
        })
    })
});

app.get('/showBooks',requireLogin,(req,res)=>{
    Book.find({})
    .populate('owner')
    .sort({date:'desc'})
    .then((books)=> {
        res.render('showBooks',{
            books:books
        })
    })
});
//receive image
app.post('/uploadImage',requireLogin,upload.any(),(req,res) =>{
    const form = new formidable.IncomingForm();
    form.on('file',(feild,file)=>{
        console.log(file);
    });
    form.on('error',(err) =>{
        console.log(err);
    });
    form.on('end',()=>{
        console.log('Image received successfully..');
    });
    form.parse(req);
});
//log out user
app.get('/logout',(req,res)=>{
    User.findById({_id:req.user._id})
    .then((user) => {
        user.online = false;
        user.save((err,user) => {
            if (err){
                throw err;
            }
            if(user) {
                req.logout();
                res.redirect('/');
            }
        });
    });
});
//maps route
app.get('/openGoogleMap',(req,res) =>{
    res.render('googlemap');
});
//display info of one book
app.get('/displayBook/:id',(req,res)=>{
    Book.findOne({_id:req.params.id}).then((book) =>{
        res.render('displayBook',{
            book:book
        });
    }).catch((err) =>{console.log(err)});
})
//open owner profile page
app.get('/showOwner/:id',(req,res) =>{
    User.findOne({_id:req.params.id})
    .then((owner)=> {
        res.render('ownerProfile',{
            owner:owner
        })
    }).catch((err) =>{console.log(err)});
})
//renting a book
app.get('/RentBook/:id',(req,res) =>{
    Book.findOne({_id:req.params.id})
    .then((book) => {
        res.render('calculate',{
            book:book
        })
    }).catch((err) =>{console.log(err)});
})
//calculate total POST request
app.post('/calculateTotal/:id',(req,res)=>{
    Book.findOne({_id:req.params.id})
    .then((book)=> {
        console.log(req.body);
        var week = parseInt(req.body.week);
        var month = parseInt(req.body.month);
        //console.log('type of week is', typeof(week));
        var totalWeek = week * book.pricePerWeek;
        var totalMonth = month * book.pricePerMonth;
        var total = totalMonth + totalWeek;
        console.log('Total is : ', total);
        //create a budget
        const budget = {
            bookID: req.params.id,
            total: total,
            renter: req.user._id,
            date: new Date()
        }
        new Budget(budget).save((err,budget) =>{
            if(err){
                console.log(err);
            }
            if(budget) {
                Book.findOne({_id:req.params.id})
                .then((book)=> {
                    //calculate total for stripe
                    var stripeTotal = budget.total * 100 *0.013;
                    res.render("checkout",{
                        budget :budget,
                        book: book,
                        StripePublishableKey: keys.StripePublishableKey,
                        stripeTotal: stripeTotal
                    })
                    
                }).catch((err)=>{console.log(err)});
            }
        })
    })
})
//Charge client
app.post('/chargeRenter/:id',(req,res)=>{
    Budget.findOne({_id:req.params.id})
    .populate('renter')
    .then((budget) =>{
        const amount = budget.total *100;
        stripe.customers.create({
            email: req.body.stripeEmail,
            source: req.body.stripeToken
        })
        .then((customer)=>{
            stripe.charges.create({
                amount:amount,
                description: `Rs.${budget.total} for renting the book.`,
                currency: 'inr',
                customer: customer.id,
                receipt_email: customer.email
            },(err,charge)=>{
                if(err) {
                    console.log(err);
                }
                if(charge){
                    console.log(charge);
                    res.render('success',{
                        charge: charge,
                        budget: budget
                    })
                }
            })
        }).catch((err)=>{console.log(err)});
    }).catch((err)=>{console.log(err)});
})
//socket connection
const server = http.createServer(app);
const io = socketIO(server);
//connect to client
io.on('connection',(socket)=>{
    console.log('Connected to Client');
    //handle chat room route
    app.get('/chatOwner/:id',(req,res)=>{
       Chat.findOne({sender: req.params.id,receiver:req.user._id})
       .then((chat)=>{
           if(chat){
               chat.date = new Date(),
               chat.senderRead = false;
               chat.receiverRead = true;
               chat.save()
               .then((chat)=>{
                   res.redirect(`/chat/${chat._id}`);
               }).catch((err)=>{console.log(err)});
           }else{
               Chat.findOne({sender:req.user._id,receiver:req.params.id})
               .then((chat)=>{
                   if(chat){
                       chat.senderRead = true;
                       chat.receiverRead = false;
                       chat.date = new Date()
                       chat.save()
                       .then((chat)=>{
                           res.redirect(`/chat/${chat._id}`);
                       }).catch((err) => {console.log(err)});
                   }else{
                       const newChat = {
                           sender: req.user._id,
                           receiver: req.params.id,
                           date: new Date()
                       }
                       new Chat(newChat).save().then((chat) =>{
                           res.redirect(`/chat/${chat._id}`);
                       }).catch((err)=>{console.log(err)});
                   }
               }).catch((err) => {console.log(err)});
           }
       }).catch((err) =>{console.log(err)}); 
    });
    //Hnadle /chat/chat ID route
    app.get('/chat/:id',(req,res)=>{
        Chat.findOne({_id:req.params.id})
        .populate('sender')
        .populate('receiver')
        .populate('dialogue.sender')
        .populate('dialogue.receiver')
        .then((chat) =>{
            res.render('chatRoom',{
                chat:chat
            })
        }).catch((err) => {console.log(err)});
    })
    //Post request to /chat/ID
    app.post('/chat/:id', (req,res)=>{
        Chat.findById({_id:req.params.id})
        .populate('sender')
        .populate('receiver')
        .populate('dialogue.sender')
        .populate('dialogue.receiver')
        .then((chat)=>{
            const newDialogue = {
                sender: req.user._id,
                date: new Date(),
                senderMessage: req.body.message
            }
            chat.dialogue.push(newDialogue)
            chat.save((err,chat)=>{
                if(err){
                    console.log(err);
                }
                if(chat) {
                    Chat.findOne({_id:chat._id})
                    .populate('sender')
                    .populate('receiver')
                    .populate('dialogue.sender')
                    .populate('dialogue.receiver')
                    .then((chat) =>{
                        res.render('chatRoom',{chat:chat});
                    }).catch((err)=>{console.log(err)});
                }
            })
        }).catch((err)=>{console.log(err)});
    })
    //listen to ObjectID
    socket.on('ObjectID',(oneBook) => {
        console.log('One Book is ', oneBook);
        Book.findOne({
            owner:oneBook.userID,
            _id:oneBook.bookID
        })
        .then((book) =>{
            socket.emit('book',book);
        }).catch();
    });
    //Find books and send them to browser to maps
    Book.find({}).then((books) =>{
        socket.emit('allbooks',{books:books});
    }).catch((err)=>{
        console.log(err);
    });
    //listen to event to receive lat and lng
    socket.on('LatLng',(data)=>{
        console.log(data);
        //find a book object and update the lat and lng
        Book.findOne({owner:data.book.owner})
        .then((book)=>{
            book.coords.lat = data.data.results[0].geometry.location.lat;
            book.coords.lng = data.data.results[0].geometry.location.lng;
            book.save((err,book) =>{
                if(err) {
                    throw err;
                }
                if(book){
                    console.log('Book lat and lng is updated!')
                }
            })
        }).catch((err)=>{
            console.log(err);
        });
    });
    //listen to disconnection
    socket.on('disconnect',(socket)=>{
        console.log('Disconnected from Client');
    });
});
server.listen(port,() => {
    console.log(`Server running on port ${port}`);
});