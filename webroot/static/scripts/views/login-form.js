/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Login Form View.
 *
 * [argument] params (URLSearchParams) query info in the current URL
 * [return] view (Object) LoginFormView instance, when called with `new`
 */
BzDeck.views.LoginForm = function LoginFormView (params) {
  // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
  this.host = params.get('server') === 'dev' ? 'mozilla-dev' : 'mozilla';

  this.$form = document.querySelector('#app-login [role="form"]');
  this.$statusbar = document.querySelector('#app-login [role="status"]');

  // Hide the incompatible browser message
  this.show_status('');

  this.on('SessionController:StatusUpdate', data => {
    this.show_status(data.message);

    if (data.status === 'ForcingLogin') {
      this.show();
    }

    if (data.status === 'LoadingData') {
      this.hide();
      this.hide_intro();
    }
  }, true);

  this.on('SessionController:Error', data => {
    this.show_status(data.message);

    if (data.error) {
      console.error(data.error);
    }
  }, true);

  this.on('SessionController:Logout', data => {
    this.show();
  }, true);

  this.activate_bugzilla_auth();

  if (this.helpers.env.device.mobile) {
    this.activate_qrcode_auth();
  }
};

BzDeck.views.LoginForm.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.LoginForm.prototype.constructor = BzDeck.views.LoginForm;

BzDeck.views.LoginForm.prototype.show = function (firstrun = true) {
  this.$form.setAttribute('aria-hidden', 'false');
  this.$bzauth_button.focus();

  return !firstrun;
};

BzDeck.views.LoginForm.prototype.hide = function () {
  this.$form.setAttribute('aria-hidden', 'true');
};

BzDeck.views.LoginForm.prototype.hide_intro = function () {
  document.querySelector('#app-intro').setAttribute('aria-hidden', 'true');
};

BzDeck.views.LoginForm.prototype.show_status = function (message) {
  this.$statusbar.textContent = message;
};

BzDeck.views.LoginForm.prototype.activate_bugzilla_auth = function () {
  this.$bzauth_button = this.$form.querySelector('[data-id="bugzilla-auth"]');

  // The event type should be click and window.open should be in this event handler, otherwise the new window will be
  // blocked by the browser's popup blocker
  this.$bzauth_button.addEventListener('click', event => {
    let callback_url = `${location.origin}/integration/bugzilla-auth-callback/`,
        auth_url = `${BzDeck.config.servers[this.host].url}/auth.cgi`
                 + `?callback=${encodeURIComponent(callback_url)}&description=BzDeck`;

    this.trigger(':LoginRequested', { host: this.host })

    // Take the user to the Bugzilla authentication page. window.open doesn't work on the Android WebAppRT (Bug 1183897)
    // so open the auth (and later callback) page in the current window (#293). Otherwise, the auth flow should be done
    // in a sub window.
    // http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html
    if (FlareTail.helpers.env.platform.android) {
      location.replace(auth_url);
    } else {
      window.open(auth_url, 'bugzilla-auth');
    }
  });
};

BzDeck.views.LoginForm.prototype.activate_qrcode_auth = function () {
  this.$qrauth_button = this.$form.querySelector('[data-id="qrcode-auth"]');
  this.$qrauth_button.addEventListener('mousedown', event => {
    let $overlay = document.querySelector('#qrcode-auth-overlay'),
        $scan_button,
        $video,
        stream;

    let decode = () => {
      let qrcode = $overlay.querySelector('iframe').contentWindow.qrcode,
          $canvas = document.createElement('canvas'),
          width = $canvas.width = $video.videoWidth,
          height = $canvas.height = $video.videoHeight;

      $canvas.getContext('2d').drawImage($video, 0, 0, width, height);
      qrcode.callback = result => this.trigger(':QRCodeDecoded', { host: this.host, result });
      qrcode.decode($canvas.toDataURL('image/png'));
    };

    let hide_overlay = () => {
      this.$qrauth_button.focus();
      $overlay.setAttribute('aria-hidden', 'true');
      $scan_button.setAttribute('aria-disabled', 'true');

      if (stream) {
        stream.getVideoTracks()[0].stop();
        $video.pause();
      }
    };

    if (!$overlay) {
      $overlay = document.body.appendChild(this.get_template('qrcode-auth-overlay-template'));
      $overlay.querySelector('.banner-nav-button').addEventListener('mousedown', event => hide_overlay());
    }

    if (!$scan_button) {
      $scan_button = $overlay.querySelector('[data-id="scan"]');
      $scan_button.addEventListener('mousedown', event => { decode(); hide_overlay(); });
    }

    this.helpers.event.async(() => $overlay.removeAttribute('aria-hidden'));
    $video = $overlay.querySelector('video');
    $scan_button.focus();

    navigator.mediaDevices.getUserMedia({ audio: false, video: true }).then(input => {
      stream = input;
      $video.src = URL.createObjectURL(stream);
      $video.play();
      $scan_button.setAttribute('aria-disabled', 'false');
    }).catch(error => {
      hide_overlay();
      this.trigger(':QRCodeError', { error });
    });
  });
};
