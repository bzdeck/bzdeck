/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Login Form View that represents the user sign-in UI on the landing page.
 * @extends BzDeck.BaseView
 */
BzDeck.LoginFormView = class LoginFormView extends BzDeck.BaseView {
  /**
   * Get a LoginFormView instance.
   * @constructor
   * @argument {URLSearchParams} params - Query info in the current URL.
   * @return {Object} view - New LoginFormView instance.
   */
  constructor (params) {
    super(); // This does nothing but is required before using `this`

    // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
    this.host = params.get('server') === 'dev' ? 'mozilla-dev' : 'mozilla';

    this.$form = document.querySelector('#app-login [role="form"]');
    this.$statusbar = document.querySelector('#app-login [role="status"]');

    // Hide the incompatible browser message
    this.show_status('');

    this.subscribe('SessionController:StatusUpdate', true);
    this.subscribe('SessionController:Error', true);
    this.subscribe('SessionController:Logout', true);

    this.activate_bugzilla_auth();

    if (this.helpers.env.device.mobile) {
      this.activate_qrcode_auth();
    }
  }

  /**
   * Display the sign-in form when no active account is found.
   *
   * @argument {undefined}
   * @return {undefined}
   */
  show () {
    this.$form.setAttribute('aria-hidden', 'false');
    this.$bzauth_button.focus();
  }

  /**
   * Hide the sign-in form while loading data.
   *
   * @argument {undefined}
   * @return {undefined}
   */
  hide () {
    this.$form.setAttribute('aria-hidden', 'true');
  }

  /**
   * Hide the introductory paragraph on from the sign-in form.
   *
   * @argument {undefined}
   * @return {undefined}
   */
  hide_intro () {
    document.querySelector('#app-intro').setAttribute('aria-hidden', 'true');
  }

  /**
   * Display a message on the sign-in form.
   *
   * @argument {String} message - Message to show.
   * @return {undefined}
   */
  show_status (message) {
    this.$statusbar.textContent = message;
  }

  /**
   * Display the "Sign in with Bugzilla" button that triggers Bugzilla's Authentication Delegation process. When the
   * button is clicked, take the user to the Bugzilla authentication page.
   *
   * @argument {undefined}
   * @return {undefined}
   * @see {@link http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html}
   */
  activate_bugzilla_auth () {
    this.$bzauth_button = this.$form.querySelector('[data-id="bugzilla-auth"]');

    // The event type should be click and window.open should be in this event handler, otherwise the new window will be
    // blocked by the browser's popup blocker
    this.$bzauth_button.addEventListener('click', event => {
      let callback_url = `${location.origin}/integration/bugzilla-auth-callback/`,
          auth_url = `${BzDeck.config.servers[this.host].url}/auth.cgi`
                   + `?callback=${encodeURIComponent(callback_url)}&description=BzDeck`;

      this.trigger(':LoginRequested', { host: this.host })
      window.open(auth_url, 'bugzilla-auth');
    });
  }

  /**
   * Display the "Sign in with QR Code" button on mobile. The user can quickly sign into the app by capturing a QR code
   * displayed on BzDeck for desktop, that encodes the user's Bugzilla account name and API key. The decoding is done by
   * a third-party library. This may not work depending on the spec of the device's camera.
   *
   * @argument {undefined}
   * @return {undefined}
   */
  activate_qrcode_auth () {
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
      }

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
  }

  /**
   * Called by SessionController whenever the sign-in status is updated. Update the UI accordingly.
   *
   * @argument {Object} data - Passed data.
   * @argument {String} data.status - Current status.
   * @argument {String} data.message - Message text to display.
   * @return {undefined}
   */
  on_status_update (data) {
    this.show_status(data.message);

    if (data.status === 'ForcingLogin') {
      this.show();
    }

    if (data.status === 'LoadingData') {
      this.hide();
      this.hide_intro();
    }
  }

  /**
   * Called by SessionController whenever an error is detected during the sign-in process. Show the error message.
   *
   * @argument {Object} data - Passed data.
   * @argument {Error}  data.error - Error encountered.
   * @argument {String} data.message - Message text to display.
   * @return {undefined}
   */
  on_error (data) {
    this.show_status(data.message);

    if (data.error) {
      console.error(data.error);
    }
  }

  /**
   * Called by SessionController when the user has logged out from the app. Show the sign-in form again.
   *
   * @argument {undefined}
   * @return {undefined}
   */
  on_logout () {
    this.show();
  }
}
