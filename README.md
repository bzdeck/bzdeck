# BzDeck

A useful experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.

* [BzDeck](https://www.bzdeck.com/)
* [Introducing BzDeck](https://www.bzdeck.com/about/)
* [BzDeck FAQ](https://www.bzdeck.com/faq/)
* [FlareTail.js](https://github.com/bzdeck/flaretail.js) integrated as a submodule
* We are on [Facebook](https://www.facebook.com/BzDeck), [Twitter](https://twitter.com/BzDeck) and [Google+](https://www.google.com/+BzDeck)

## How to run the app locally

BzDeck is mostly written in static HTML, CSS and JavaScript, but you need PHP as well. No server-side database is required at this moment.

### Apache + PHP

Nothing special, just set up a normal local server.

1. Fork this repository
2. Add a new virtual host in your Apache config as below
3. Add a new host in your `/etc/hosts`: `127.0.0.1 local.bzdeck.com`
4. Restart your Apache server with PHP 5.4+ enabled
5. Open `http://local.bzdeck.com/` in your browser

Apache config example:
```conf
<VirtualHost *:80>
  ServerName local.bzdeck.com
  DocumentRoot "/path/to/bzdeck/webroot/"
</VirtualHost>
```

### PHP only

If you want to run a local development server without Apache, do the following:

1. Install PHP >= 5.4.0 (e.g. In Ubuntu 14.04: `sudo apt-get install php5`)
2. Run `run_dev_server.sh`
3. Open your browser ([Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or [Firefox Nightly](http://nightly.mozilla.org/)), go to `http://localhost:8000`

## Debug mode

Append `?debug=true` to any BzDeck URL to enable the debug mode. All the JavaScript files will be served separately and some debug messages will get dumped.

If some API tests are required, a Bugzilla instance for testing is available at [bugzilla-dev.allizom.org](https://bugzilla-dev.allizom.org/). Ask your password on [IRC](ircs://irc.mozilla.org:6697/bmo) or sign in with your GitHub account. Once a new API key is generated on the Preferences page, sign out from BzDeck and load the app again by appending `?debug=true&server=dev` to the URL.
