import express = require('express');
import bodyParser = require('body-parser');
import {SixShooter} from './models/Guns';
const app = express();

app.listen(3000, () => {
  console.log('Listening on port 3000. No routes available.');
});