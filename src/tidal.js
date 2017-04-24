var request = require('request');
var rp = require('request-promise');
var fs = require('fs');
var config = require('../config');
var utils = require('./utils');
var db = require('./db');
var jp = require('jsonpath');
var Promise = require('bluebird');

module.exports = function () {

    return {
        fullDownloadPath: null,
        albumId: null,
        albumName: null,
        artistName: null,
        albumYear: null,
        albumDate: null,
        albumTracks: [],
        albumDir: null,
        albumPopularity: null,
        albumDuration: null,
        albumTracksCount: null,
        coverId: null,
        quality: null,
        defaultParams: null,
        sessionFile: null,
        skipTags: false,
        clientCredentials: null,
        isCompilation: false,
        isFlac: false,
        isPlaylist: false,

        init() {
            console.log('TIDAL Downloader');
            this.setDefaultRequestParams();
            this.setClient();
            this.getSessionId();
        },

        setClient(client) {

            switch (client) {
                default:
                case 'android':
                    this.clientCredentials = config.clients.android;
                    this.sessionFile = '.sessionid_android';
                    break;

                case 'ios':
                    this.clientCredentials = config.clients.ios;
                    this.sessionFile = '.sessionid_ios';
                    break;

                case 'pc':
                    this.clientCredentials = config.clients.pc;
                    this.sessionFile = '.sessionid_pc';
                    break;
            }

        },

        getSessionId() {
            var url = config.api + 'v1/login/username?countryCode=' + config.countryCode;

            var params = {
                'body': 'username=' + config.userCredentials.login
                + '&password=' + config.userCredentials.password
                + '&token=' + this.clientCredentials.token
                + '&clientVersion=' + this.clientCredentials.version,

                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': this.clientCredentials.userAgent
                }
            };

            try {
                console.log('Pobieram nowy klucz sesji');

                request.post(url, params, (err, httpResponse, result) => {

                    var body = utils.parseJson(result);

                    if (body.sessionId != '') {
                        config.sessionId = body.sessionId;
                        console.log('Klucz sesji: %s', config.sessionId);
                        this.saveSessionId();
                    } else {
                        console.log('Brak klucza sesji w odpowiedzi serwera');
                        console.log(body);
                        //process.exit();
                    }
                })

            } catch (e) {
                console.log('BLAD! Serwer nie zwrocil identyfikatora sesji');
            }

        },

        saveSessionId() {
            utils.saveFile(this.sessionFile, config.sessionId);
        },

        loadSessionId() {
            try {
                config.sessionId = fs.readFileSync(this.sessionFile, 'utf8');

                if (config.sessionId) {
                    console.log('Wczytuje klucz sesji z pliku');
                }
            } catch (e) {
                this.getSessionId();
            }
        },

        determineAlbumType(tracks) {
            var artists = [];

            tracks.forEach((track) => {
                artists[track.artist.name + ''] = true;
            });

            this.isCompilation = Object.keys(artists).length > 1;

            //console.log('Czy to kompilacja', this.isCompilation);
        },

        getAlbumTracks(result) {
            if (result) {
                var body = utils.parseJson(result);

                if (body.items) {
                    this.determineAlbumType(body.items);

                    this.albumDir = utils.filterChars(this.artistName + ' - ' + this.albumName) + ' (' + this.albumYear + ')';

                    //console.log('Pobieram album: ' + this.albumDir);
                    //console.log(this.isCompilation ? 'Ten album to kompilacja' : 'Ten album to nie jest kompilacja');
                    //console.log('Pobieram adresy utworow...');

                    body.items.forEach((track) => {
                        var trackNumber = utils.pad(track.trackNumber, 2);
                        var title = (track.version !== null) ? track.title + ' (' + track.version + ')' : track.title;
                        var fileExt = this.isFlac ? '.flac' : '.m4a';
                        var artist = this.isCompilation ? track.artist.name + ' - ' : '';
                        var name = track.volumeNumber + 'x' + trackNumber + ' ' + artist + title + fileExt;
                        var fileName = utils.filterChars(name);

                        this.albumTracks.push({
                            'trackId': track.id,
                            'disc': track.volumeNumber,
                            'trackNumber': trackNumber,
                            'artist': track.artist.name,
                            'title': title,
                            'filename': fileName,
                            'usable': track.allowStreaming,
                            'duration': track.duration,
                            'popularity': track.popularity,
                            'isrc': track.isrc
                        });
                    });

                } else {
                    console.log('Album o takim id nie istnieje');
                }

            } else {
                console.log('Nie udalo sie pobrac listy utworow!');
                console.log(url);
                //process.exit();
            }

        },

        showAlbumFromDB(id) {
            return db.find(id).then(response => {
                console.log('odpowiedz bazy', response);
                return response;
            }).catch(err => console.log);
        },

        showAlbumFromInternet(id, res) {
            var albumInfoUrl = utils.buildUrl(config.api + 'v1/albums/' + id);
            var albumTracksUrl = utils.buildUrl(config.api + 'v1/albums/' + id + '/tracks');

            console.log('pobieram info o albumie z sieci');

            rp(albumInfoUrl).then(response => {

                this.getAlbumInfo(response);
                return rp(albumTracksUrl);

            }).then(response => {

                this.getAlbumTracks(response);

                var album = {
                    albumId: id,
                    albumDir: this.albumDir,
                    coverUrl: utils.getCoverUrl(this.coverId, "small"),
                    coverUrlFolder: utils.getCoverUrl(this.coverId, "medium"),
                    coverUrlBig: utils.getCoverUrl(this.coverId, "big"),
                    artistName: this.artistName,
                    albumName: this.albumName,
                    albumDate: this.albumDate,
                    albumYear: this.albumYear,
                    albumPopularity: this.albumPopularity,
                    albumDuration: this.albumDuration,
                    albumTracksCount: this.albumTracksCount,
                    isCompilation: this.isCompilation,
                    albumTracks: this.albumTracks
                };
                //console.log(album)
                db.addAlbum(album); // nie musze tu na nic czekac
                res.send(album);

            }).catch(err => console.log) // Don't forget to catch errors;
        },

        showAlbum(id, res) {
            this.showAlbumFromDB(id).then(response => {
                console.log('odpowiedz z promisa', response);
                if (response == '') {
                    console.log('nie znaleziono albumu w bazie');
                    this.showAlbumFromInternet(id, res);
                } else {
                    res.send(response[0]);
                }
            });
        },

        downloadAlbum(id, res) {
            var albumInfoUrl = utils.buildUrl(config.api + 'v1/albums/' + id);
            var albumTracksUrl = utils.buildUrl(config.api + 'v1/albums/' + id + '/tracks');

            rp(albumInfoUrl).then(response => {

                this.getAlbumInfo(response);
                return rp(albumTracksUrl);

            }).then(response => {

                this.getAlbumTracks(response);
                res.send({
                    albumId: id,
                    albumDir: this.albumDir,
                    coverUrl: utils.getCoverUrl(this.coverId, "small"),
                    coverUrlFolder: utils.getCoverUrl(this.coverId, "medium"),
                    coverUrlBig: utils.getCoverUrl(this.coverId, "big"),
                    artistName: this.artistName,
                    albumName: this.albumName,
                    albumDate: this.albumDate,
                    albumYear: this.albumYear,
                    albumPopularity: this.albumPopularity,
                    albumDuration: this.albumDuration,
                    albumTracksCount: this.albumTracksCount,
                    isCompilation: this.isCompilation,
                    albumTracks: this.albumTracks
                });

            }).catch(err => console.log) // Don't forget to catch errors;            
        },

        getAlbumInfo: function (result) {
            if (result) {
                var body = utils.parseJson(result);

                //console.log(result)

                try {
                    this.artistName = body.artist.name;
                    this.albumName = body.title;
                    this.coverId = body.cover;
                    this.albumYear = body.releaseDate.split('-')[0];
                    this.albumDate = body.releaseDate;
                    this.albumPopularity = body.popularity;
                    this.albumDuration = body.duration;
                    this.albumTracksCount = body.numberOfTracks;
                } catch (e) {
                    console.log('Brak niezbednych danych albumu');
                }

            } else {
                console.log('Album o takim id nie istnieje');
                //console.log(url);
            }
        },
        setDefaultRequestParams() {
            request.defaults({
                'headers': {
                    'User-Agent': config.userAgent
                }
            });
        },

        getAlbumsFromUrl(url) {
            var albumsFound = [];

            return rp(url).then(result => {
                //request.get(url, (err, response, result) => {
                if (result) {
                    var body = utils.parseJson(result);

                    try {
                        var albums = jp.query(body, '$..items[*]');

                        if (albums.length > 0) {

                            for (var index = 0; index < albums.length; ++index) {
                                var album = albums[index];

                                albumsFound.push({
                                    id: album.id,
                                    artist: album.artists[0].name,
                                    album: album.title,
                                    date: album.releaseDate,
                                    cover: utils.getCoverUrl(album.cover, "miniature"),
                                    popular: album.popularity
                                });
                            }

                            return albumsFound;
                        }
                    } catch (e) {
                        console.log(body);
                        return {
                            status: 0
                        }
                    }
                }

            }).catch(err => console.log);
        },

        searchAlbum(str, res) {
            var limit = 50,
                url = utils.buildUrl(config.api + 'v1/search', 'query=' + str + '&limit=' + limit + '&offset=0&types=ALBUMS');

            return this.getAlbumsFromUrl(url).then(response => {
                res.send(response);
            });
        },

        category(category, res) {
            var limit = 100;

            switch (category) {
                case "recommended":
                    url = utils.buildUrl(config.api + 'v1/featured/recommended/albums', 'limit=' + limit);
                    break;
                case "rising":
                    url = utils.buildUrl(config.api + 'v1/rising/new/albums', 'limit=' + limit);
                    break;
                default:
                case "new":
                    url = utils.buildUrl(config.api + 'v1/featured/new/albums', 'limit=' + limit);
                    break;
                case "top":
                    url = utils.buildUrl(config.api + 'v1/featured/top/albums', 'limit=' + limit);
                    break;
                case "top-pl":
                    url = utils.buildUrl(config.api + 'v1/featured/local/albums', 'limit=' + limit);
                    break;
            }

            return this.getAlbumsFromUrl(url).then(response => {
                res.send(response);
            });
        },

        downloadTrack(trackObj, quality) {
            var fullDownloadPath = utils.hasSlash(config.downloadPath) + utils.hasSlash(trackObj.album.albumDir) + trackObj.track.filename;
            var quality = utils.setQuality(config.quality);
            var trackId = trackObj.track.trackId;

            //console.log('Utwor id', trackId, 'jakosc', quality);

            if (!utils.fileExists(fullDownloadPath)) {

                //return this.delay().then(result => {

                return this.getTrackUrl(trackId, quality).catch(err => console.error).then(trackResult => {
                    //console.log('Pobieram docelowy adres pliku', trackResult);

                    if (typeof trackResult === 'function') {
                        console.error('---- ZOSTALES ZABLOKOWANY ----');
                    } else {
                        return utils.downloadFile(trackResult, fullDownloadPath, {
                            trackId: trackId
                        }).catch(err => console.error);
                    }

                }).catch(err => console.error);

                //});

            } else {
                return Promise.reject('Plik istnieje');
            }
        },

        addTags(trackObj) {
            var fullDownloadPath = utils.hasSlash(config.downloadPath) + utils.hasSlash(trackObj.album.albumDir);
            var trackFile = fullDownloadPath + trackObj.track.filename;

            var album = trackObj.album;
            var track = trackObj.track;

            // TODO dodać gatunek / genre jezeli jest w danych albumu

            var mp4box_tags = ''
                + 'album=' + album.albumName
                + ':album_artist=' + album.artistName
                //+ ':artist=' + (album.isCompilation ? tags.artist : this.artistName)
                + ':artist=' + album.artistName
                + ':tracknum=' + track.trackNumber
                + ':name=' + track.title
                + ':disk=' + track.disc
                + ':created=' + album.albumYear
                + (album.isCompilation ? ':compilation=yes' : '')
                //+ (this.isPlaylist ? '' : ':cover=' + this.fullDownloadPath + 'folder.jpg');
                + ':cover=' + fullDownloadPath + 'folder.jpg';

            //console.log('Tagi mp4box', mp4box_tags);

            var mp4box_params = [
                utils.quote(trackFile),
                '-itags',
                utils.quote(mp4box_tags)
            ];

            utils.runCmd("mp4box", mp4box_params);
        },

        setCountry(countryCode) {
            console.log('Ustawiam kod kraju na: %s', countryCode);
            TidalConfig.countryCode = countryCode;
        },

        delay() {

            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve();
                }, 5000);
            });

        },

        getTrackUrl(id, quality) {
            //var trackUrl = utils.buildUrl(config.api + 'v1/tracks/' + id + '/streamUrl', 'soundQuality=' + quality);

            var trackUrl = 'https://api.tidalhifi.com/v1/tracks/' + id + '/streamUrl?soundQuality=HIGH&countryCode=PL';
            console.log('Pobieram adres dla track', trackUrl);

            return rp(trackUrl, {
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) TIDAL/2.1.5.228 Chrome/53.0.2785.143 Electron/1.4.12 Safari/537.36',
                    'X-Tidal-SessionId': config.sessionId,
                    'Referer': 'https://desktop.tidal.com/search/albums/vangelis',
                    'Accept-Encoding': 'gzip, deflate',
                    'Accept-Language': 'pl'
                }
            }, (error, response, body) => {
                //console.log('error:', error); // Print the error if one occurred 
                //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received 

                if (response && response.statusCode == 401) {
                    return Promise.reject('Brak uprawnien!').catch(err => console.error);
                }

            }).then(response => {

                console.log('getTrackUrl', response);

                var body = utils.parseJson(response);
                var trackFileUrl = body.url;

                return trackFileUrl;

            }).catch(err => console.error);

        },

        getPreviewUrl(id, res) {
            var url = 'https://api.tidal.com/v1/tracks/' + id + '/previewurl?token=S0wuxKXcRQLsoQ6R&countryCode=PL'

            return rp(url).then(response => {
                console.log('preview', id)
                console.log('response', response)

                var body = utils.parseJson(response);

                res.send(JSON.stringify(body));
            });
        },

        getAllGenres(res) {
            var url = utils.buildUrl(config.api + 'v1/genres');

            return rp(url).then(response => {
                var body = utils.parseJson(response);
                res.send(JSON.stringify(body));
            });
        },

        getGenre(id, res) {
            var limit = 200;
            var url = utils.buildUrl(config.api + 'v1/genres/' + id + '/albums' + '&limit=' + limit);

            return this.getAlbumsFromUrl(url).then(response => {
                res.send(response);
            });
        }

    }
}