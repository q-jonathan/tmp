const axios = require("axios");
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
const port = process.env.PORT || 5001;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const exposed = require("./routes/exposedAPI.js");
app.use("/api", exposed);

// if (process.env.NODE_ENV == "production") {
//   const root = require("path").join(__dirname, "client", "build");
//   console.log("production: " + root);
//   app.use(express.static(root));
//   app.get("*", (req, res) => {
//     res.sendFile("index.html", { root });
//   });
// }

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});