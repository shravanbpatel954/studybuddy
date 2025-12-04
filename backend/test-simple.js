const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.send('Server is working!');
});

const port = 8080;
app.listen(port, () => {
    console.log(`Test server running on http://localhost:${port}`);
});
