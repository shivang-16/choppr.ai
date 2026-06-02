import express from 'express';
import { config } from 'dotenv';

const app: express.Application = express();

 config({
    path: "./.env",
  });


app.get('/', (req, res) => {
  res.send('Hello World!');
});

export default app;