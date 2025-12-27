require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const port = process.env.port || 9876;

app.use(cors());
app.use(express.json());

mongoose.connect(
    process.env.MONGO_URI
).then(() => {
    console.log("MongoDB connected");
}).catch((err) => {
    console.log("Mongo error ",err);
})


const UserSchema = new mongoose.Schema({
    userName: String,
    password: String, 
});

const User = mongoose.model("User", UserSchema);


const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader)
    {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try
    {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch(err)
    {
        return res.status(401).json({ message: "Invalid token" });
    }

}

const NoteSchema = new mongoose.Schema({
    title : {
        type: String,
        required: true,
    },
    content: {
        type: String,
    },
    tags: {
        type: [String],
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    }, 
  },
  { timestamps: true }
);

const Note = mongoose.model("Note", NoteSchema);

app.post("/notes", authMiddleware, async (req, res) => {
    const userId = req.user.userId;

    const {title, content, tags} = req.body;

    const note = await Note.create({
        title: title,
        content: content,
        tags: tags,
        userId: userId,
    });

    res.json(note);
});

//filters belon to query params not routes
//query params => www.localhost/9876/notes?tag=work

app.get("/notes", authMiddleware, async (req, res) => {
    const { tag } = req.query

    let filter = { userId: req.user.userId };

    //empty strings are falsy so tags are not passed
    if(tag)
    {
        filter.tags = tag;
    }

    const notes = await Note.find(filter);
    res.json(notes);
});


app.put("/notes/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    
    const {title, content, tags} = req.body;

    const note = await Note.findOneAndUpdate(
        {_id: id, userId: req.user.userId},
        { title, content, tags },
        { new: true }
    );

    res.json(note);
});


app.delete("/notes/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;

    await Note.deleteOne({
        _id: id,
        userId: req.user.userId
    });

    res.json( { message: "Note deleted" });
});

//find() - returns an array
//findOne() - returns an document
// [] - returns true

//409 - duplicate username conflict
//401 - wrong password, user not found - unauthorized

app.post("/signup", async (req, res) => {
    const {username, password} = req.body;

    if(!username || !password)
    {
        return res.status(400).json({ message: "Missing fields" });
    }

    const repeatedUserName = await User.findOne({ userName: username});

    if(repeatedUserName)
    {
        return res.status(409).json({ message: "Same user name exists" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        userName: username,
        password: hashPassword,
    });

    res.json({ message: "User created" });
});

app.post("/login", async (req, res) => {
    const {username, password}  = req.body;

    const user = await User.findOne({ userName: username });

    if(!user)
    {
        return res.status(401).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if(!isMatch)
    {
        return res.status(401).json({ message: "Wrong Password" });
    }

    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET
    );

    res.json({ token });
});

app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
})