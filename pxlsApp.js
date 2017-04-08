function getQueryVariable(a) {
    for (var b = window.location.search.substring(1).split("\x26"), c = 0; c < b.length; c++) {
        var d = b[c].split("\x3d");
        if (decodeURIComponent(d[0]) === a) return decodeURIComponent(d[1])
    }
}

function hexToRgb(a) {
    return (a = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(a)) ? {
        r: parseInt(a[1], 16),
        g: parseInt(a[2], 16),
        b: parseInt(a[3], 16)
    } : null
}
window.App = {
    elements: {
        board: $("#board"),
        palette: $(".palette"),
        boardMover: $(".board-mover"),
        boardZoomer: $(".board-zoomer"),
        boardContainer: $(".board-container"),
        cursor: $(".cursor"),
        timer: $(".cooldown-timer"),
        reticule: $(".reticule"),
        alert: $(".message"),
        coords: $(".coords"),
        users: $(".online"),
        grid: $(".grid")
    },
    panX: 0,
    panY: 0,
    scale: 4,
    hasFiredNotification: !0,
    init: function() {
        this.color = -1;
        $(".board-container").hide();
        $(".reticule").hide();
        $(".ui").hide();
        $(".message").hide();
        $(".cursor").hide();
        $(".cooldown-timer").hide();
        $(".online").hide();
        $(".grid").hide();
        this.initBoard({"width":1000,"height":1000,"palette":["#FFFFFF","#E4E4E4","#888888","#222222","#FFA7D1","#E50000","#E59500","#A06A42","#E5D900","#94E044","#02BE01","#00D3DD","#0083C7","#0000EA","#CF6EE4","#820080"]});
        this.initBoardPlacement();
        this.initBoardMovement();
        this.initCursor();
        this.initReticule();
        this.initAlert();
        this.initCoords();
        this.initGrid();
        this.initInfo();
        Notification.requestPermission()
    },
    initBoard: function(a) {
        this.width = a.width;
        this.height = a.height;
        this.palette = a.palette;
        this.initPalette();
        this.elements.board.attr("width", this.width).attr("height", this.height);
        this.updateTransform();
        a = getQueryVariable("x") || this.width /
            2;
        var b = getQueryVariable("y") || this.height / 2;
        this.centerOn(a, b);
        this.scale = getQueryVariable("scale") || this.scale;
        this.updateTransform();
        this.initSocket();
        setInterval(this.updateTime.bind(this), 1E3);
        jQuery.get("./boarddata", this.drawBoard.bind(this))
    },
    drawBoard: function(a) {
        for (var b = this.elements.board[0].getContext("2d"), c = new ImageData(this.width, this.height), d = new Uint32Array(c.data.buffer), f = this.palette.map(function(b) {
                b = hexToRgb(b);
                return 4278190080 | b.b << 16 | b.g << 8 | b.r
            }), e = 0; e < this.width * this.height; e++) d[e] =
            f[a.charCodeAt(e)];
        b.putImageData(c, 0, 0)
    },
    initPalette: function() {
        this.palette.forEach(function(a, b) {
            $("\x3cdiv\x3e").addClass("palette-color").css("background-color", a).click(function() {
                this.cooldown < (new Date).getTime() ? this.switchColor(b) : this.switchColor(-1)
            }.bind(this)).appendTo(this.elements.palette)
        }.bind(this))
    },
    initBoardMovement: function() {
        var a = function(b) {
            this.panX += b.dx / this.scale;
            this.panY += b.dy / this.scale;
            this.updateTransform()
        }.bind(this);
        interact(this.elements.boardContainer[0]).draggable({
            inertia: !0,
            onmove: a
        }).gesturable({
            onmove: function(b) {
                this.scale *= 1 + b.ds;
                this.updateTransform();
                a(b)
            }.bind(this)
        });
        $(document.body).on("keydown", function(b) {
            if (87 === b.keyCode || 38 === b.keyCode) this.panY += 100 / this.scale;
            else if (65 === b.keyCode || 37 === b.keyCode) this.panX += 100 / this.scale;
            else if (83 === b.keyCode || 40 === b.keyCode) this.panY -= 100 / this.scale;
            else if (68 === b.keyCode || 39 === b.keyCode) this.panX -= 100 / this.scale;
            this.updateTransform()
        }.bind(this));
        this.elements.boardContainer.on("wheel", function(b) {
            var a = this.scale;
            this.scale = 0 < b.originalEvent.deltaY ? this.scale / 1.5 : 1.5 * this.scale;
            this.scale = Math.floor(Math.min(40, Math.max(2, this.scale)));
            var d = b.clientX - this.elements.boardContainer.width() / 2;
            b = b.clientY - this.elements.boardContainer.height() / 2;
            this.panX -= d / a;
            this.panX += d / this.scale;
            this.panY -= b / a;
            this.panY += b / this.scale;
            this.updateTransform()
        }.bind(this))
    },
    initBoardPlacement: function() {
        var a, b, c = function(c) {
                a = c.clientX;
                b = c.clientY
            },
            d = function(c) {
                var d = Math.abs(b - c.clientY);
                5 > Math.abs(a - c.clientX) && 5 > d && -1 !==
                    this.color && this.cooldown < (new Date).getTime() && (c = this.screenToBoardSpace(c.clientX, c.clientY), this.attemptPlace(c.x | 0, c.y | 0))
            }.bind(this);
        this.elements.board.on("pointerdown", c).on("mousedown", c).on("pointerup", d).on("mouseup", d).contextmenu(function(b) {
            b.preventDefault();
            this.switchColor(-1)
        }.bind(this))
    },
    initCursor: function() {
        var a = function(b) {
            this.elements.cursor.css("transform", "translate(" + b.clientX + "px, " + b.clientY + "px)")
        }.bind(this);
        this.elements.boardContainer.on("pointermove", a).on("mousemove",
            a)
    },
    initReticule: function() {
        var a = function(b) {
            b = this.screenToBoardSpace(b.clientX, b.clientY);
            b.x |= 0;
            b.y |= 0;
            b = this.boardToScreenSpace(b.x, b.y);
            this.elements.reticule.css("transform", "translate(" + b.x + "px, " + b.y + "px)");
            this.elements.reticule.css("width", this.scale - 1 + "px").css("height", this.scale - 1 + "px"); - 1 === this.color ? this.elements.reticule.hide() : this.elements.reticule.show()
        }.bind(this);
        this.elements.board.on("pointermove", a).on("mousemove", a)
    },
    initCoords: function() {
        var a = function(b) {
            b = this.screenToBoardSpace(b.clientX,
                b.clientY);
            this.elements.coords.text("(" + (b.x | 0) + ", " + (b.y | 0) + ")")
        }.bind(this);
        this.elements.board.on("pointermove", a).on("mousemove", a)
    },
    initAlert: function() {
        /*this.elements.alert.find(".close").click(function() {
            this.elements.alert.fadeOut(200)
        }.bind(this))*/
    },
    initSocket: function() {
        var a = window.location;
            /*b = new WebSocket(("https:" === a.protocol ? "wss://" : "ws://") + a.host + a.pathname + "ws");
        b.onmessage = function(a) {
            a = JSON.parse(a.data);
            if ("pixel" === a.type) {
                var c = this.elements.board[0].getContext("2d");
                c.fillStyle =
                    this.palette[a.color];
                c.fillRect(a.x, a.y, 1, 1)
            } else "alert" === a.type ? this.alert(a.message) : "cooldown" === a.type ? (this.cooldown = (new Date).getTime() + 1E3 * a.wait, this.updateTime(0), this.hasFiredNotification = 0 === a.wait) : "captcha_required" === a.type ? (grecaptcha.reset(), grecaptcha.execute()) : "captcha_status" === a.type ? a.success ? (a = this.pendingPixel, this.switchColor(a.color), this.attemptPlace(a.x, a.y)) : alert("Failed captcha verification") : "users" === a.type ? (this.elements.users.fadeIn(200), this.elements.users.text(a.count +
                " online")) : "session_limit" === a.type && (b.onclose = function() {}, this.alert("Too many sessions open, try closing some tabs."))
        }.bind(this);
        b.onclose = function() {
            setTimeout(function() {
                window.location.reload()
            }, 1E4 * Math.random() + 3E3);
            this.alert("Lost connection to server, reconnecting...")
        };*/
		this.cooldown = 0;
        $(".board-container").show();
        $(".ui").show();
        $(".loading").fadeOut(500);
      //  this.socket = b
    },
    initGrid: function() {
        $(document.body).keydown(function(a) {
            71 === a.keyCode && this.elements.grid.fadeToggle({
                duration: 100
            })
        }.bind(this))
    },
    initInfo: function() {
        $(document.body).keydown(function(a) {
            72 === a.keyCode && ($(".instructions").fadeToggle({
                duration: 100
            }), $(".bubble-container").fadeToggle({
                duration: 100
            }))
        })
    },
    updateTransform: function() {
        this.elements.boardMover.css("width", this.width + "px").css("height", this.height + "px").css("transform", "translate(" + this.panX + "px, " + this.panY + "px)");
        this.elements.boardZoomer.css("transform", "scale(" + this.scale + ")");
        this.elements.reticule.css("width", this.scale + "px").css("height", this.scale + "px");
        var a =
            this.screenToBoardSpace(0, 0);
        this.elements.grid.css("background-size", this.scale + "px " + this.scale + "px").css("transform", "translate(" + Math.floor(-a.x % 1 * this.scale) + "px," + Math.floor(-a.y % 1 * this.scale) + "px)")
    },
    screenToBoardSpace: function(a, b) {
        var c = this.elements.board[0].getBoundingClientRect();
        return {
            x: (a - c.left) / this.scale,
            y: (b - c.top) / this.scale
        }
    },
    boardToScreenSpace: function(a, b) {
        var c = this.elements.board[0].getBoundingClientRect();
        return {
            x: a * this.scale + c.left,
            y: b * this.scale + c.top
        }
    },
    centerOn: function(a,
        b) {
        this.panX = 500 - a - .5;
        this.panY = 500 - b - .5;
        this.updateTransform()
    },
    switchColor: function(a) {
        this.color = a; - 1 === a ? this.elements.cursor.hide() : (this.elements.cursor.show(), this.elements.cursor.css("background-color", this.palette[a]))
    },
    attemptPlace: function(a, b) {
        /*this.pendingPixel = {
            x: a,
            y: b,
            color: c
        };*/
		var c = this.elements.board[0].getContext("2d");
		c.fillStyle = this.palette[this.color];
		c.fillRect(a, b, 1, 1);
        /*this.socket.send(JSON.stringify({
            type: "placepixel",
            x: a,
            y: b,
            color: c
        }));*/
        //this.switchColor(-1)
    },
    alert: function(a) {
        /*var b = this.elements.alert;
        b.find(".text").text(a);
        b.fadeIn(200)*/
    },
    updateTime: function() {
        var a =
            (this.cooldown - (new Date).getTime()) / 1E3;
        if (0 < a) {
            this.elements.timer.show();
            var b = Math.floor(a % 60),
                b = 10 > b ? "0" + b : b,
                a = Math.floor(a / 60),
                a = 10 > a ? "0" + a : a;
            this.elements.timer.text(a + ":" + b);
            $(".palette-color").css("cursor", "not-allowed");
            document.title = "Pxls.space [" + a + ":" + b + "]"
        } else this.hasFiredNotification || (new Notification("Pxls.space", {
            body: "Your next pixel is available!"
        }), this.hasFiredNotification = !0), document.title = "Pxls.space", this.elements.timer.hide(), $(".palette-color").css("cursor", "")
    },
    saveImage: function() {
        this.elements.board[0].toBlob(function(a) {
            var b =
                window.URL.createObjectURL(a),
                c = document.createElement("a");
            c.href = b;
            c.download = "canvas.png";
            c.click();
            window.URL.revokeObjectURL(a)
        })
    }
};

function recaptchaCallback(a) {
   /* App.socket.send(JSON.stringify({
        type: "captcha",
        token: a
    }))*/
}
App.init();