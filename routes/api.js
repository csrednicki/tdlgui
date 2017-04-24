var express = require('express');
var router = express.Router();
var tidal = require('../src/tidal');
var queue = require('../src/queue');
var sse = require('../src/sse');
var events = require('../src/events');

router.get('/', function (req, res, next) {
  res.send('api');
});

router.get('/search', function (req, res, next) {

  var q = req.query.query;

  if (typeof q === 'string' && q.length >= 3) {
    tidal().searchAlbum(q, res);
  } else {
    res.send([]);
  }
});

router.get('/categories/:category', function (req, res, next) {
  tidal().category(req.params.category, res);
});

router.get('/genres', function (req, res, next) {
  tidal().getAllGenres(res);
});

router.get('/genres/:genre', function (req, res, next) {
  tidal().getGenre(req.params.genre, res);
});

router.get('/getAlbumInfo', function (req, res, next) {
  tidal().showAlbum(req.query.id, res);
});

router.get('/addToQueue', function (req, res, next) {
  queue.addToQueue(req.query, res);
});

router.get('/preview/:id', function (req, res, next) {
  var id = parseFloat(req.params.id) || 0;

  tidal().getPreviewUrl(id, res);
});

router.get('/queue/events', function(req, res) {
  events.sseSetup(req, res);
});

router.get('/queue', function(req, res) {
  queue.getQueue(res);
});

module.exports = router;
