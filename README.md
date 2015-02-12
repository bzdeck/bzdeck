# BzDeck

A useful experimental Bugzilla client demonstrating modern Web application technologies such as CSS3, DOM4, HTML5, ECMAScript 6 and WAI-ARIA.

* [BzDeck](https://www.bzdeck.com/)
* [Introducing BzDeck](https://www.bzdeck.com/about/)
* [BzDeck FAQ](https://www.bzdeck.com/faq/)
* [FlareTail.js](https://github.com/kyoshino/flaretail.js)

## How to run the app locally

1. Add a new virtual host in your Apache config:
  ```conf
  <VirtualHost *:80>
    ServerName local.bzdeck.com
    DocumentRoot "/path/to/bzdeck/directory/"
  </VirtualHost>
  ```

2. Add a new host in your `/etc/hosts`: `127.0.0.1 local.bzdeck.com`
3. Restart your Apache server
4. Open `http://local.bzdeck.com/` in your browser
