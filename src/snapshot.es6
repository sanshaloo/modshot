'use strict';

var nopt = require('nopt'),
    path = require('path'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    _ = require('lodash');

// Default options
var options = {
    'quiet': false,
    'in-dir': process.cwd()
};

// log messages to the console
function log(message, override) {
    // only log for non-quiet mode
    if (!options.quiet || override) {
        console.log(message);
    }
}

function man() {
    const USAGE = `
    USAGE snapshot [options]*

    Options:
    --in-dir | -i       The input directory to recurse and fetch the HTML files. Uses current directory if not specified
    --help | -h         Displays this information
    --quiet | -q        Keeps the console clear from logging.
    `;
    log(USAGE);
}

// Check if the tool was called from command line
function isCLI() {
    return require.main === module;
}

function exit(msg) {
    if (msg) {
        log(msg, true);
    }
    if (isCLI()) {
        return process.exit(0);
    }
}

function parseOptions() {
    let knownOpts = {
            'in-dir': path,
            'quiet': Boolean,
            'help': Boolean
        },
        shortHands = {
            'i': ['--in-dir'],
            'q': ['--quiet'],
            'h': ['--help']
        },
        resolved = _.assign(options, nopt(knownOpts, shortHands));

    if (resolved.help) {
        man();
        return exit();
    }
    return resolved;
}

function stat(file) {
    return new Promise((resolve, reject) => {
        fs.stat(file, (err, stats) => {
            if (err) {
                return reject(err);
            }
            resolve(stats);
        });
    });
}

function readdir(dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                return reject(err);
            }
            resolve(files);
        });
    });
}

function getFileList(inputDir) {
    let eventEmitter = new EventEmitter(),
        readdirWrapper = dir => {
            readdir(dir).then(list => {
                return Promise.all(list.map(item => path.join(dir, item)).map(item => {
                    return stat(item).then(stats =>  _.assign(stats, {
                        origFile: item
                    }));
                }));
            }).then(statsList => {
                statsList.forEach((stats) => {
                    let file = stats.origFile;
                    if (stats.isDirectory(file)) {
                        // Call the wrapper again
                        readdirWrapper(file);
                    } else if (stats.isFile(file) && path.extname(file) === '.html') {
                        eventEmitter.emit('file', file);
                    }
                });
            }).catch(err => exit(err));
        };

    // call the wrapper
    readdirWrapper(inputDir);

    // return the Event Emitter
    return eventEmitter;
}

// Start the main execution
function exec() {
    getFileList(options['in-dir']).on('file', file => console.log(file));
}

function run() {
    // set the options
    options = parseOptions();
    // execute snap
    exec();
}

if (isCLI()) {
    run();
}