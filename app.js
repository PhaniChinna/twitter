const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB error ${error.message}`);
    process.exit(1);
  }
};
initializeDbServer();

const validPassword = (password) => {
  return password.length > 6;
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectedQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectedQuery);
  if (dbUser === undefined) {
    const insertUser = `
        INSERT INTO 
           user(username , password , name , gender)
        VALUES ('${username}' , '${hashedPassword}' , '${name}' , '${gender}');`;
    if (validPassword(password)) {
      const list = await db.run(insertUser);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "ABCDEF");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const selectUser = `
        SELECT 
          user.username , tweet.tweet , tweet.date_time AS dateTime
        FROM 
           follower
        INNER JOIN tweet 
           ON follower.follower_user_id = tweet.user_id
        INNER JOIN user 
           ON user.user_id = tweet.user_id
        WHERE 
          follower.follower_user_id = follower_user_id
        ORDER BY 
           tweet.date_time DESC 
        LIMIT 4`;
  const result = await db.all(selectUser);
  response.send(result);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const getName = `
        SELECT 
           user.name 
        FROM 
          follower 
        INNER JOIN user 
           ON follower.follower_user_id = user.user_id
        WHERE 
           follower.follower_user_id = follower_user_id`;
  const result = await db.all(getName);
  response.send(result);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = `
        SELECT 
          name 
        FROM 
          user 
        INNER JOIN follower 
           ON user.user_id = follower.follower_id 
        WHERE 
          user.user_id = user_id`;
  const result = await db.all(username);
  response.send(result);
});

//API 6
app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const queryList = `
        SELECT 
          tweet.tweet , COUNT(reply) AS reply  ,tweet.date_time AS dateTime   
        FROM 
          follower 
        INNER JOIN tweet 
           ON follower.follower_user_id = tweet.tweet_id
        INNER JOIN reply
            ON reply.reply_id = tweet.tweet_id
        WHERE 
           follower.follower_user_id = follower_user_id`;
  const Reply = await db.get(queryList);
  response.send(Reply);
});

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const tweet = `
        SELECT 
          tweet.tweet 
        FROM 
          tweet 
        INNER JOIN user 
          ON user.user_id = tweet.tweet_id`;
  const result = await db.all(tweet);
  response.send(result);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const tweetCreated = `
    INSERT INTO 
       tweet(tweet)
    VALUES ('${tweet}');`;
  const result = await db.run(tweetCreated);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweet = `
        DELETE 
        FROM 
           tweet
        WHERE 
          tweet_id = '${tweetId}';`;
    const listDelete = await db.run(deleteTweet);
    if (listDelete !== undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.status(200);
      response.send("Tweet Removed");
    }
  }
);
module.exports = app;
