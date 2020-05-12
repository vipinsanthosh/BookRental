//load modules
const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const bcryt = require('bcryptjs');
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

//load Files
const keys = require('./config/keys');
//load connection
const User = require('./models/user');
const Contact = require('./models/contact');
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
    defaultLayout: 'main'
}));
app.set('view engine','handlebars');
//connect clint side to server css and js files
app.use(express.static('public'));
//create port
const port = process.env.PORT || 3000;
//handle home route
app.get('/',(req,res) => {
    res.render('home');
});
app.get('/about',(req,res) =>{
    res.render('about',{
        title: 'About'
    });
});
app.get('/contact',(req,res) =>{
    res.render('contact',{
        title: 'Contact us'
    });
});
//save contact form data
app.post('/contact', (req,res)=> {
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
app.get('/signup',(req,res) =>{
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
            password:req.body.password,
            password2:req.body.password2,
            email: req.body.email
        })
    }else{
        User.findOne({email:req.body.email})
        .then((user) =>{
            if (user) {
                let errors = [];
                errors.push({text:'Email already exists!'});
                res.render('signupForm',{
                    errors:errors
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
                        console.log('New user is created!');
                    }
                })
            }
        })
    }
});
app.listen(port,() => {
    console.log(`Server running on port ${port}`);
});