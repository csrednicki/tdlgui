var async = require('async');
var tidal = require('./tidal');
var utils = require('./utils');
var config = require('../config');
var sse = require('../src/sse');

module.exports = {

    tracksQueue: {},
    items: [],

    init() {
        this.tracksQueue = async.queue((task, onComplete) => {
            var name = task.track.filename;

            console.log('Rozpoczynam pobieranie: ' + name)

            tidal().downloadTrack(task).then(response => {

                // tagowanie utworu po zakonczeniu pobierania
                tidal().addTags(task);

            }).finally(response => {
                // zakonczenie zadania kolejki
                onComplete();
            }).catch(err => console.error);

        }, config.concurrentJobs);

        this.tracksQueue.drain = () => {
            console.log('Kolejka pobierania jest pusta!');

            this.changeInQueue('removeAllItems', null);
        };
    },

    changeInQueue(action, data) {
        sse.emit(action, data);
    },

    initDownload(album) {
        var fullDownloadPath = utils.hasSlash(config.downloadPath) + utils.hasSlash(album.albumDir);
        utils.createDirectory(fullDownloadPath);

        var coverFile = fullDownloadPath + 'cover.jpg';
        var folderFile = fullDownloadPath + 'folder.jpg';

        console.log('Okladka duza', coverFile);
        console.log('Okladka mala', folderFile);

        return utils.downloadFile(album.coverUrlFolder, folderFile).then(response => {

            console.log('Okladka pobrana', folderFile)
            return utils.downloadFile(album.coverUrlBig, coverFile);

        }).then(response => {

            console.log('Okladka pobrana', coverFile)

        }).catch(err => console.error);

    },

    addToQueue(params, res) {

        tidal().showAlbumFromDB(params.id).then((albumResult) => {

            if (albumResult.length > 0) {

                var album = albumResult[0];
                var tracks = album.albumTracks;

                this.initDownload(album).then(response => {

                    tracks.forEach((el) => {
                        console.log('Przekazuje do kolejki', el.filename);

                        var queueItem = {
                            trackId: el.trackId,
                            filename: el.filename,
                            album: album.albumName,
                            artist: el.artist,
                            trackNumber: el.trackNumber,
                            title: el.title,
                            coverUrl: album.coverUrl

                        };

                        var info = {
                            track: el,
                            album: album,
                        }

                        // dodanie do wewnetrznej kolejki
                        // async.queue nie oferuje metody zobaczenia calej kolejki
                        this.items.push(queueItem);
                        this.changeInQueue('addItem', queueItem);

                        this.tracksQueue.push(info, () => {
                            // callback onComplete            

                            // usuniecie z kolejki po zakonczeniu zadania
                            // zwroc wszystkie wartosci tablicy
                            this.items = this.items.filter((obj) => {
                                // oprocz identyfikatora albumu ktory zostal wlasnie pobrany
                                return (obj.trackId !== info.track.trackId);
                            });

                            this.changeInQueue('removeItem', { trackId: info.track.trackId });
                            console.log('Zakonczylem pobieranie utworu', info.track.filename)
                        });
                    });

                });

                res.send({
                    status: 1
                });

            }

        });

    },

    getQueue(res) {
        res.status(200);
        res.send(this.items);
    }

}