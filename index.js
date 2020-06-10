var ViewState = {
    laughs: 0,
    lastLaugh: 0,
    videos: [
        {id: "j9dLVJgT79M", start: 10, title: "Easy-peasy"},
        {id: "WLvfRNwXjvU", start: 0, title: "A piece of cake"},
        {id: "VB4CCHHYOqY", start: 0, title: "Animals"},
        {id: "sHptYVmt3S8", start: 5, title: "Viners"},
        {id: "9T3YSXQWZ0g", start: 0, title: "Kids"},
        {id: "IxG3Cv5qK00", start: 0, title: "Kids 2"},
        {id: "xEsicYpehFw", start: 0, title: "Best memes"},
    ],
    isPlaying: function() {
        return this.player && this.playerReady && this.player.getPlayerState() === 1;
    },
    ended: function() {
        return this.player && this.playerReady && this.player.getPlayerState() === 0;
    }
};

var View = {
    getCameraVideo: function() {
        return document.getElementById('camera--video');
    },

    getCameraOverlay: function() {
        return document.getElementById('camera--overlay');;
    },

    getCameraOverlayContext: function() {
        return this.getCameraOverlay().getContext('2d');
    },

    onCameraVideoReady: function(callback) {
        this.getCameraVideo().addEventListener('canplay', callback, false);
    },

    adjustVideoProportions: function() {
        var video = this.getCameraVideo();
        var proportion = video.videoWidth / video.videoHeight;
        var newWidth = Math.round(video.height * proportion);
        video.width = newWidth;
        this.getCameraOverlay().width = newWidth;
    },

    setLaughOMeter: function(value) {
        ViewState.laughValue = value;
        var label = "Laugh-o-meter: ";
        label += (value === undefined) ? "?" : value + "%";
        document.getElementById('laugh-o-meter').innerText = label;
    },

    onControlButtonClicked: function(callback) {
        var button =  document.getElementById('control-button');
        button.onclick = callback;
    },

    controlButtonState: function(state) {
        var button =  document.getElementById('control-button');
        switch (state) {
            case "READY":
                button.innerText = "Click to start the video!";
                button.className = "ready";
                break;
            case "HIDDEN":
                button.className = "hidden";
                break;
            case "PAUSE":
                button.className = "pause";
                button.innerText = "The video has been paused.\nCheck if your face is clearly visible on the camera and click the button.";
                break;
        }
    },

    addLaugh: function() {
        ViewState.laughs++;
        ViewState.audio.play();
        var laughs = document.getElementById("laughs");
        var label = "Laughs: ";
        for (var i=0; i< ViewState.laughs; i++) {
            label += "🤣";
        }
        laughs.innerText = label;
    },

    final: function(text) {
        var final = document.getElementById("final");
        final.className = "";
        final.innerText = text;
    }
};

var PresentationLogic = {
    init: function () {
        this.initTracking();
        this.initCamera();
        this.initYouTubeApi();
        ViewState.audio = new Audio('sound.wav');
        View.onControlButtonClicked(this._handleControlButtonClicked.bind(this));
    },

    initTracking: function() {
        // set eigenvector 9 and 11 to not be regularized. This is to better detect motion of the eyebrows
        pModel.shapeModel.nonRegularizedVectors.push(9);
        pModel.shapeModel.nonRegularizedVectors.push(11);

        ViewState.cTrack = new clm.tracker({useWebGL: true});
        ViewState.cTrack.init(pModel);

        ViewState.classifier = new emotionClassifier();
        ViewState.classifier.init(emotionModel);
    },

    resetTracking: function() {
        ViewState.cTrack.stop();
        ViewState.cTrack.reset();
        ViewState.cTrack.start(View.getCameraVideo());
    },

    initCamera() {
        if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia({video: true}).then(this._handleUserMediaSuccess.bind(this)).catch(this._handleUserMediaError.bind(this));
        } else if (navigator.getUserMedia) {
            navigator.getUserMedia({video: true}, this._handleUserMediaSuccess.bind(this), this._handleUserMediaError.bind(this));
        } else {
            alert("Your browser does not support video :(");
        }

        View.onCameraVideoReady(this._handleCameraReady.bind(this));
    },

    _handleUserMediaSuccess(stream) {
        var video = View.getCameraVideo();

        if ("srcObject" in video) {
            video.srcObject = stream;
        } else {
            video.src = (window.URL && window.URL.createObjectURL(stream));
        }
        video.onloadedmetadata = function () {
            View.adjustVideoProportions();
            video.play();
        };
        video.onresize = function () {
            View.adjustVideoProportions();
            this.resetTracking();
        }.bind(this);
    },

    _handleUserMediaError() {
        alert("There was some problem trying to fetch video from your webcam. If you have a webcam, please make sure to accept when the browser asks for access to your webcam.");
    },

    _handleCameraReady: function() {
        introJs().start();
        View.getCameraVideo().play();
        ViewState.cTrack.start(View.getCameraVideo());
        this._loop();
    },

    initYouTubeApi: function() {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = function() {
            var parent = document.getElementById("selector");
            ViewState.videos.forEach(function (video) {
                var button = document.createElement("button");
                button.innerText = video.title;
                button.onclick = function () {
                    parent.parentNode.removeChild(parent);
                    this.createPlayer(video.id, video.start);
                }.bind(this);
                parent.appendChild(button);
            }.bind(this))
        }.bind(this);
    },

    createPlayer(videoId, start) {
        ViewState.player = new YT.Player('player', {
            height: '400',
            width: '640',
            videoId: videoId,
            events: {
                'onReady': this._handlePlayerReady.bind(this),
                'onStateChange': this._handlePlayerStateChange.bind(this)
            },
            playerVars: {
                'start': start,
                'controls': 0,
                'disablekb': 1,
                'enablejsapi': 1
            }
        });
    },

    _handlePlayerReady: function() {
        introJs().exit();
        ViewState.playerReady = true;
        View.controlButtonState("READY");
    },

    _handlePlayerStateChange: function() {
        if (ViewState.ended()) {
            View.controlButtonState("HIDDEN");
            ViewState.player.destroy();
            View.final("Total Laughs: " +  ViewState.laughs);
        }
    },

    pauseVideo: function() {
        ViewState.player.pauseVideo();
        View.controlButtonState("PAUSE");
    },

    playVideo: function() {
        ViewState.player.playVideo();
        View.controlButtonState("HIDDEN");
    },

    _handleControlButtonClicked: function() {
        this.playVideo();
    },

    _loop: function() {
        var video = View.getCameraVideo();
        var overlayContext = View.getCameraOverlayContext();
        overlayContext.clearRect(0, 0, video.width, video.height);

        if (ViewState.cTrack.getCurrentPosition()) {
            ViewState.cTrack.draw(View.getCameraOverlay());
        }

        var params = ViewState.cTrack.getCurrentParameters();
        var faceRecognised = params.some(function (value) {
            return value !== 0
        });
        if (!faceRecognised) {
            View.setLaughOMeter(undefined);
            if (Date.now() - ViewState.lastRecognised > 2000 && ViewState.isPlaying()) {
                this.pauseVideo();
            }
        } else {
            ViewState.lastRecognised = Date.now();
            var emotions = ViewState.classifier.meanPredict(params);
            if (emotions) {
                var happyFactor = Math.round(emotions[0].value * 100);
                View.setLaughOMeter(happyFactor);

                if (happyFactor >= 60 && (Date.now() - ViewState.lastLaugh > 2000) && ViewState.isPlaying()) {
                    ViewState.lastLaugh = Date.now();
                    View.addLaugh();
                }
            }
        }

        if (!ViewState.ended()) {
            setTimeout(this._loop.bind(this), 25);
        }
    }
};

PresentationLogic.init();
