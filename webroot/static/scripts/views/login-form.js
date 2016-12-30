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
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {URLSearchParams} params - Query info in the current URL.
   * @returns {LoginFormView} New LoginFormView instance.
   */
  constructor (id, params) {
    super(id); // Assign this.id

    // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
    this.host = params.get('server') === 'dev' ? 'mozilla-dev' : 'mozilla';

    this.$form = document.querySelector('#app-login [role="form"]');
    this.$statusbar = document.querySelector('#app-login [role="status"]');

    // Hide the incompatible browser message
    this.show_status('');

    // Subscribe to events
    this.subscribe('SessionPresenter#StatusUpdate', true);
    this.subscribe('SessionPresenter#Error', true);
    this.subscribe('SessionPresenter#Logout', true);

    this.activate_bugzilla_auth();

    if (FlareTail.env.device.mobile) {
      this.activate_qrcode_auth();
    }
  }

  /**
   * Display the sign-in form when no active account is found.
   */
  show () {
    this.$form.setAttribute('aria-hidden', 'false');
    this.$bzauth_button.focus();
  }

  /**
   * Hide the sign-in form while loading data.
   */
  hide () {
    this.$form.setAttribute('aria-hidden', 'true');
  }

  /**
   * Hide the introductory paragraph on from the sign-in form.
   */
  hide_intro () {
    document.querySelector('#app-intro').setAttribute('aria-hidden', 'true');
  }

  /**
   * Display a message on the sign-in form.
   * @param {String} message - Message to show.
   */
  show_status (message) {
    this.$statusbar.querySelector('p').textContent = message;
  }

  /**
   * Display the "Sign in with Bugzilla" button that triggers Bugzilla's Authentication Delegation process. When the
   * button is clicked, take the user to the Bugzilla authentication page.
   * @fires LoginFormView#LoginRequested
   * @see {@link http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html Bugzilla API}
   */
  activate_bugzilla_auth () {
    this.$bzauth_button = this.$form.querySelector('[data-id="bugzilla-auth"]');

    // The event type should be click, otherwise the new window will be blocked by the browser's popup blocker
    this.$bzauth_button.addEventListener('click', event => {
      const callback_url = `${location.origin}/integration/bugzilla-auth-callback/`;
      const auth_url = `${BzDeck.config.hosts[this.host].origin}/auth.cgi`
                     + `?callback=${encodeURIComponent(callback_url)}&description=BzDeck`;

      FlareTail.util.Navigator.open_window(auth_url, 'bugzilla-auth');
      this.trigger('#LoginRequested', { host: this.host })
    });
  }

  /**
   * Display the "Sign in with QR Code" button on mobile. The user can quickly sign into the app by capturing a QR code
   * displayed on BzDeck for desktop, that encodes the user's Bugzilla account name and API key. The decoding is done by
   * a third-party library. This may not work depending on the spec of the device's camera.
   * @fires LoginFormView#QRCodeDecoded
   * @fires LoginFormView#QRCodeError
   */
  activate_qrcode_auth () {
    this.$qrauth_button = this.$form.querySelector('[data-id="qrcode-auth"]');
    this.$qrauth_button.addEventListener('mousedown', async event => {
      const $overlay = document.querySelector('#qrcode-auth-overlay');
      let $scan_button;
      let $video;
      let stream;

      const decode = () => {
        const qrcode = $overlay.querySelector('iframe').contentWindow.qrcode;
        const $canvas = document.createElement('canvas');
        const width = $canvas.width = $video.videoWidth;
        const height = $canvas.height = $video.videoHeight;

        $canvas.getContext('2d').drawImage($video, 0, 0, width, height);
        qrcode.callback = result => this.trigger('#QRCodeDecoded', { host: this.host, result });
        qrcode.decode($canvas.toDataURL('image/png'));
      }

      const hide_overlay = () => {
        this.$qrauth_button.focus();
        $overlay.setAttribute('aria-hidden', 'true');
        $scan_button.setAttribute('aria-disabled', 'true');

        if (stream) {
          stream.getVideoTracks()[0].stop();
          $video.pause();
          URL.revokeObjectURL($video.src);
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

      (async () => $overlay.removeAttribute('aria-hidden'))();
      $video = $overlay.querySelector('video');
      $scan_button.focus();

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        $video.src = URL.createObjectURL(stream);
        $video.play();
        $scan_button.setAttribute('aria-disabled', 'false');
      } catch (error) {
        hide_overlay();
        this.trigger('#QRCodeError', { message: error.message });
      }
    });
  }

  /**
   * Called whenever the sign-in status is updated. Update the UI accordingly.
   * @listens SessionPresenter#StatusUpdate
   * @param {String} status - Current status.
   * @param {String} message - Message text to display.
   */
  on_status_update ({ status, message } = {}) {
    this.show_status(message);

    if (status === 'ForcingLogin') {
      this.show();
    }

    if (status === 'LoadingData') {
      this.hide();
      this.hide_intro();
    }
  }

  /**
   * Called whenever an error is detected during the sign-in process. Show the error message.
   * @listens SessionPresenter#Error
   * @param {String} message - Message text to display.
   */
  on_error ({ message } = {}) {
    this.show_status(message);
  }

  /**
   * Called when the user has logged out from the app. Show the sign-in form again.
   * @listens SessionPresenter#Logout
   */
  on_logout () {
    this.show();
  }
}
