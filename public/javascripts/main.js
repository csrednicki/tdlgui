TidalGUI = {

    selectedAlbum: null,
    queueList: [],
    kolejka: [],
    Queue: null,
    hoganOptions: {
        delimiters: '[[ ]]'
    },

    albumWindowContainer: '#albuminfo',

    init: function () {

        this.ajaxSetup();

        // search
        this.addSearchListener();

        // album window
        this.addshowAlbumInfoListener();
        this.addcloseAlbumWindowListener();
        this.addSendtoQueueListener();
        this.addPrevNextButtonListener();

        // queue
        this.getQueue();
        this.addQueueListener();
        this.listenSSE('queue/events');

        // categories
        this.addDropdownListener('#categories-list a', '/api/categories/');

        // genres
        this.getGenres();

        // kategoria ladowana na start
        this.getAlbums('/api/categories/new');

    },

    getQueue: function () {
        var self = this;

        $.ajax({
            url: '/api/queue',
            dataType: 'json',
            success: function (result) {
                console.log(result);

                result.forEach(function (album, index) {
                    self.queueActionAdd(album);
                });
               
            },
            error: function (error) {
                console.error(error);
            }
        });

    },

    getGenres: function () {
        var self = this;
        var genresContainer = $('#genres-list');
        var genreMenuItemTpl = $('#genreMenuItemTpl').text();

        $.ajax({
            url: '/api/genres/',
            dataType: 'json',
            success: function (result) {
                console.log(result);

                result.forEach(function (album, index) {
                    var genreItem = Hogan.compile(genreMenuItemTpl, self.hoganOptions).render(album);
                    genresContainer.append(genreItem);
                });

                self.addDropdownListener('#genres-list a', '/api/genres/');
            },
            error: function (error) {
                console.error(error);
            }
        });

    },

    initPlayer: function () {

        //var $tracklistItem = $('#tracklist ul li');

        var a = audiojs.createAll({
            trackEnded: function () {
                var next = $('#tracklist ul li.playing').next();

                if (!next.length) {
                    next = $('#tracklist ul li').first();
                }

                next.addClass('playing').siblings().removeClass('playing');

                audio.load($('a', next).attr('data-src'));

                audio.play();
            }
        });

        // Load in the first track
        var audio = a[0];
        // first = $('#tracklist ul a').attr('data-src');
        // $('#tracklist ul li').first().addClass('playing');
        // audio.load(first);

        // Load in a track on click
        $('#tracklist ul li:not(.notusable)').click(function (e) {
            e.preventDefault();

            var $anchor = $('a', this);
            var id = $anchor.attr('data-id');
            var $self = $(this);

            function play() {
                $self.addClass('playing').siblings().removeClass('playing');
                audio.load($anchor.attr('data-src'));
                audio.play();
            }

            if ($anchor.attr('data-src') == '') {
                $.ajax({
                    url: '/api/preview/' + id,
                    dataType: 'json',
                    success: function (result) {
                        $anchor.attr('data-src', result.url);
                        play();
                    },
                    error: function (error) {
                        console.error(error);
                    }
                });
            } else {
                play();
            }

        });

        // // Keyboard shortcuts
        // $(document).keydown(function(e) {
        //   var unicode = e.charCode ? e.charCode : e.keyCode;
        //      // right arrow
        //   if (unicode == 39) {
        //     var next = $('li.playing').next();
        //     if (!next.length) next = $('ol li').first();
        //     next.click();
        //     // back arrow
        //   } else if (unicode == 37) {
        //     var prev = $('li.playing').prev();
        //     if (!prev.length) prev = $('ol li').last();
        //     prev.click();
        //     // spacebar
        //   } else if (unicode == 32) {
        //     audio.playPause();
        //   }
        // });

    },

    queueUpdateCounter: function () {
        var count = $('#queue-list li').length;

        $('#queue-count').text(count);
    },

    queueActionAdd: function (data) {
        console.log('queueActionAdd', data);

        var itemTpl = $('#queueItemTpl').text();
        var itemHtml = Hogan.compile(itemTpl, this.hoganOptions).render(data);

        $('#queue-list').append(itemHtml);

        // aktualizacja licznika kolejki
        this.queueUpdateCounter();
    },

    queueActionRemove: function (data) {
        var self = this;

        console.log('queueActionRemove', data);

        $('#queue-item-' + data.trackId).find('.progress-bar').width('100%').text('Pobrano').removeClass('active');

        // usuniecie z listy dopiero po 5 sekundach
        setTimeout(function () {
            $('#queue-item-' + data.trackId).remove();

            // aktualizacja licznika kolejki
            self.queueUpdateCounter();
        }, 5000);

    },

    queueActionRemoveAll: function () {
        console.log('queueActionRemoveAll');
        $('#queue-list').empty();

        this.queueUpdateCounter();
    },

    queueActionUpdateProgress: function (data) {
        console.log('queueActionUpdateProgress', data);
        data.percent = Math.round(parseFloat(data.progress) * 100) + '%';

        $('#queue-item-' + data.trackId).find('.progress-bar').width(data.percent).text(data.percent);
    },

    listenSSE: function (channel) {

        var self = this;

        if (!!window.EventSource) {
            var source = new EventSource('/api/' + channel)

            source.addEventListener('message', function (e) {
                var eventData = JSON.parse(e.data);

                switch (eventData.action) {
                    case "addItem":
                        self.queueActionAdd(eventData.payload);
                        break;
                    case "removeItem":
                        self.queueActionRemove(eventData.payload);
                        break;
                    case "removeAllItems":
                        self.queueActionRemoveAll();
                        break;
                    case "updateProgress":
                        self.queueActionUpdateProgress(eventData.payload);
                        break;
                }

            }, false);


            // source.addEventListener(event, function (e) {
            //     console.log('Kanal', channel, event, e.data)
            // }, false)

            // source.addEventListener('open', function (e) {
            //     console.log('Kanal', channel, "Connection was opened")
            // }, false)

            // source.addEventListener('error', function (e) {
            //     if (e.readyState == EventSource.CLOSED) {
            //         console.log('Kanal', channel, "Connection was closed")
            //     }
            // }, false)
        }


    },

    ajaxSetup: function () {
        var self = this;

        $.ajaxSetup({
            beforeSend: function () {
                self.ajaxBeforeSend();
            },
            complete: function () {
                self.ajaxOnComplete();
            }
        });
    },

    ajaxBeforeSend: function () {
        this.toggleSpinner();
    },

    ajaxOnComplete: function () {
        this.toggleSpinner();
    },

    toggleSpinner: function () {
        $('#spinner').toggle();
    },

    addSearchListener: function () {
        var self = this;

        $('#search button').click(function (e) {
            e.preventDefault();
            var input = $('#search input').val();
            self.getAlbums('/api/search', input);
        });
    },

    addDropdownListener: function (selector, api) {
        var self = this;

        $(selector).click(function (e) {
            e.preventDefault();
            $('ul.dropdown-menu li').removeClass('active'); // wylaczamy zaznaczenie dla wszystkich menu

            var category = e.target.hash.substr(1);
            self.getAlbums(api + category);
            $(this).parent().addClass('active');
        });
    },

    addPrevNextButtonListener: function () {
        var self = this;
        var keys = {
            37: 'prev',
            39: 'next'
        };

        $('#nextAlbum, #prevAlbum').click(function (e) {
            e.preventDefault();
            self.showSiblingAlbum(e.target.id == 'nextAlbum' ? 'next' : 'prev');
        });

        $('#albuminfo').on('keydown', function (e) {
            e.preventDefault();
            self.showSiblingAlbum(keys[e.which]);
        });
    },

    getAlbums: function (apiUrl, apiData) {
        var self = this;
        var data = apiData || '';

        $.ajax({
            url: apiUrl,
            data: {
                query: data
            },
            dataType: 'json',
            success: function (result) {
                console.log(result);

                if (result.length > 0) {
                    self.renderAlbums(result);
                } else {
                    console.error('Brak wynikow');
                }
            },
            error: function (error) {
                console.error(error);
            }
        });
    },

    renderAlbums: function (albums, sortBy, orderBy) {
        var resultsContainer = $('#results');
        var albumItemTpl = $('#albumItemTpl').html();
        var sortField = '';
        var sortOrder = [];
        var self = this;

        // wyczyszczenie kontenera wynikow
        resultsContainer.empty();

        if (sortBy !== 'none') {

            switch (sortBy) {
                default:
                case "popularity":
                    sortField = 'popular';
                    break;
                case "date":
                    sortField = 'date';
                    break;
                case "artist":
                    sortField = 'artist';
                    break;
            }

            if (orderBy === 'asc') {
                sortOrder = ['asc', 'desc'];
            } else {
                sortOrder = ['desc', 'asc'];
            }

            albums = _.orderBy(albums, [sortField], sortOrder);

        }

        albums.forEach(function (album, index) {
            var albumItem = Hogan.compile(albumItemTpl, self.hoganOptions).render(album);
            resultsContainer.append(albumItem);
        });

    },

    showSiblingAlbum: function (direction) {

        if (direction && this.isAlbumWindowOpened()) {
            console.log('direction', direction);

            var $active = $('#results li.item.active');
            var sibling = {};

            sibling = (direction === 'prev') ? $active.prev() : $active.next();

            if (sibling.length > 0) {
                this.showAlbum(sibling.data('id'));
            }
        }
    },

    showAlbum: function (id) {
        var self = this;

        if (id) {
            console.log('selected album id: ', id);

            $.ajax({
                url: '/api/getAlbumInfo',
                data: {
                    id: id
                },
                success: function (result) {
                    self.showAlbumWindow(result);
                    self.initPlayer();
                },
                error: function (error) {
                    console.error(error);
                }
            });

        }
    },

    markAlbumActive: function () {
        var id = this.selectedAlbum.albumId;
        var album = $('#results li.item[data-id=' + id + ']');
        album.addClass('active');
    },

    markAlbumInActive: function () {
        var album = $('#results li.item.active');
        album.removeClass('active');
    },

    addshowAlbumInfoListener: function () {
        var self = this;
        $('#results').on('click', '.item', function (e) {
            var id = $(this).data('id');
            self.showAlbum(id);
            console.log('showAlbumWindow', id)
        });
    },

    showAlbumWindow: function (result) {
        this.markAlbumInActive(); // oznaczamy inne albumy jako nie aktywne

        this.selectedAlbum = result;

        var $content = $('#albuminfo-content');
        var $title = $('#albuminfo-title');
        var albumTpl = $('#albumInfoTpl').text();

        result.kompilacja = result.isCompilation ? 'Ten album to kompilacja' : 'Ten album to nie jest kompilacja';
        result.duration = this.parseDuration(result.albumDuration);

        var titleTpl = Hogan.compile("[[albumDir]]", this.hoganOptions);
        var albumTitle = titleTpl.render(result);

        var albumCompiledTpl = Hogan.compile(albumTpl, this.hoganOptions);
        var albumContent = albumCompiledTpl.render(result);

        $title.html(albumTitle);
        $content.html(albumContent);

        this.markAlbumActive(); // oznaczamy wybrany album jako aktywny
        $(this.albumWindowContainer).show();

    },

    isAlbumWindowOpened: function () {
        return $(this.albumWindowContainer).is(":visible");
    },

    parseDuration: function (duration) {
        return new Date(parseInt(duration) * 1000).toISOString().substr(11, 8);
    },

    closeAlbumWindow: function () {

        this.markAlbumInActive();

        // schowanie okna
        $(this.albumWindowContainer).hide();

        // wyczyszczenie danych
        $('#albuminfo-content').empty();
        $('#albuminfo-title').empty();

        // wyczyszczenie danych wybranego albumu
        this.selectedAlbum = null;
    },

    addcloseAlbumWindowListener: function () {
        var self = this;

        $(this.albumWindowContainer).on('click', '.closeAlbumWindow', function (e) {
            console.log('closeAlbumWindow');
            self.closeAlbumWindow();
        });
    },

    addQueueListener: function () {
        $('#results').on('click', '.download', function (e) {
            var id = $(this).data('id');

            if (id) {
                console.log('id: ', id);

                $.ajax({
                    url: '/api/getAlbumInfo',
                    data: {
                        id: id
                    },
                    success: function (result) {
                        console.log(result);
                    },
                    error: function (error) {
                        console.error(error);
                    }
                });

            }
        });
    },

    addSendtoQueueListener: function () {
        var self = this;
        $('body').on('click', '#sendtoQueue', function (e) {
            var id = self.selectedAlbum.albumId,
                name = self.selectedAlbum.albumDir;

            if (id) {
                console.log('Wysylam do kolejki album id:', id);

                $.ajax({
                    url: '/api/addToQueue',
                    data: {
                        id: id,
                        name: name
                    },
                    success: function (result) {
                        console.log('addToQueue', result);

                        self.queueList = result;
                        self.closeAlbumWindow();
                    },
                    error: function (error) {
                        console.error(error);
                    }
                });
            }
        });
    }

};

$(document).ready(function () {
    TidalGUI.init();
});
