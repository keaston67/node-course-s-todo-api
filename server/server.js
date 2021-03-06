require('./config/config');

const _ =  require('lodash');
const express = require('express');
const bodyParser = require('body-parser');

// require ObjectID to access utility methods
const {ObjectID} = require('mongodb');
// Require the mongoose file/variable using ES6 destructuring
var {mongoose} = require('./db/mongoose');
var {Todo} = require('./models/todo');
var {User} = require('./models/user'); 
var {authenticate} = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT

// register (body-parser) middleware - can now send JSON to
// our express application
app.use(bodyParser.json());

//  Configure routes 
app.post('/todos', authenticate, (req, res) => {
// use body parser to take JSON object to send to server 
// use console.log to see request body & where gets stored to by body parser
// console.log(req.body);

// create an instance of a new mongoose model
var todo = new Todo({
    text: req.body.text,
    _creator: req.user._id
});
// save to mongoDB using mongoose save method
todo.save().then((doc)  => {
    // console.log('new todo created');
    res.send(doc);
// error handling with status code   
}, (e) => {
res.status(400).send(e);
    });
});

// get todos:
app.get('/todos', authenticate,(req, res) => {
    Todo.find({
        _creator: req.user._id
    }).then((todos) => {
    // console.log('todos found');
        // send back an object instead of an array
    res.send({todos});
    }, (e) => {
        res.status(400).send(e);
    });
});

// get a todo by id. GET /todos/123456:
app.get('/todos/:id', authenticate, (req, res) => {
//  res.send(req.params);
 var id = req.params.id;
//  Validate id using {ObjectID} utility method
if (!ObjectID.isValid(id)) {
   return res.status(404).send();
 }

//  find by ID
Todo.findOne({
    _id: id,
    _creator: req.user._id
}).then((todo) => { 
    // no todo
    if(!todo) {
        return res.status(404).send();
        }
    // Success
    // console.log('todo found by id');
        res.send({todo})
    // catch error
    }).catch((e) => {
    res.status(400).send();
        });
    });    

// delete a todo:
app.delete('/todos/:id', authenticate, (req, res) => {
    var id = req.params.id;
    //  Validate id using {ObjectID} utility method
if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }
//   find and remove todo by Id
Todo.findOneAndRemove({
    _id: id,
    _creator: req.user._id
}).then((todo) => {
    //   if no doc, send 404
if(!todo) {
    return res.status(404).send();
    }
    // Success, return doc and 200
    // console.log('todo deleted');
    res.send({todo});
// error send 400 and empty body
}).catch((e) => {
    res.status(400).send();
    });
});

// update a todo:
app.patch('/todos/:id', authenticate, (req, res) => {
    var id = req.params.id;
    // create a body variable with subset of only things we want user able to update 
    var body = _.pick(req.body, ['text','completed']);
    // console.log('req body: ', body );
    //  Validate id using {ObjectID} utility method
    if (!ObjectID.isValid(id)) {
        // console.log("invalid id");
        return res.status(404).send();
      }
    //   update the completed property
      if (_.isBoolean(body.completed) && body.completed) {
        // console.log("body completed")
        // set new timestamp
        body.completedAt = new Date().getTime();
      } else {
        body.completed = false;
        body.completedAt = null;
      }
      Todo.findOneAndUpdate({_id: id, _creator: req.user._id}, {$set: body}, {new: true}).then((todo) => {
        if (!todo) {
            return res.status(404).send();
        }
        // console.log("todo updated");
        res.send({todo});
      }).catch((e) => {
         res.status(400).send(); 
      })
});

//  POST /users
app.post('/users', (req, res) => {
// use lodash method to pick out only the fields want from user input
var body = _.pick(req.body, ['email','password']);
var user = new User(body
//     {
//     email: body.email,
//     password: body.password
// }
);
// save to mongoDB using mongoose save method
user.save().then(()  => {
    // console.log('new user created');
// return chaining promise call
    return user.generateAuthToken();     
}).then((token) => {
    res.header('x-auth', token).send(user);
}).catch((e) => {
res.status(400).send(e);
    })
});

//  first private route
app.get('/users/me', authenticate, (req, res) =>{
    res.send(req.user);
});

// POST /users/login {email, password}
app.post('/users/login', (req, res) => {
    var body = _.pick(req.body, ['email','password']);
    User.findByCredentials(body.email, body.password).then((user) => {
        return user.generateAuthToken().then((token) => {
        res.header('x-auth', token).send(user);
        });
    }).catch((e) => {
        res.status(400).send();
    });
});
    
app.delete('/users/me/token',  authenticate, (req, res) => {
    req.user.removeToken(req.token).then(() => {
        res.status(200).send();
        }, () => {
            res.status(400).send();
        });
});

app.listen(port, () => {
    console.log(`started up at port ${port}`);
});
  
module.exports = {app};