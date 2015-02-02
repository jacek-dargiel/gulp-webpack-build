'use strict';

var path = require('path'),
    through = require('through2'),
    tildify = require('tildify'),
    gulp = require('gulp'),
    gutil = require('gulp-util'),
    defaults = require('defaults'),
    webpack = require('webpack'),
    WebpackConfig = require('webpack-config'),
    Compiler = require('./lib/compiler'),
    util = require('./lib/util');

var PLUGIN_NAME = 'gulp-webpack-build',
    defaultStatsOptions = {
        colors: true,
        hash: false,
        timings: false,
        chunks: false,
        chunkModules: false,
        modules: false,
        children: true,
        version: true,
        cached: false,
        cachedAssets: false,
        reasons: false,
        source: false,
        errorDetails: false
    },
    defaultVerboseStatsOptions = {
        colors: true,
        version: false
    };

function wrapError(err) {
    return new gutil.PluginError(PLUGIN_NAME, err);
}

function getFiles(stats) {
    var files = [];

    if (stats) {
        var compilation = stats.compilation,
            assets = compilation.assets || {},
            compiler = compilation.compiler,
            fs = compiler.outputFileSystem,
            file = compilation.options.file;

        return Object.keys(assets).map(function(name) {
            var emitted = assets[name].emitted === true;

            if (emitted) {
                var outputPath = fs.join(compiler.outputPath, name),
                    base = path.resolve(outputPath, file.base),
                    contents = fs.readFileSync(outputPath);

                return new gutil.File({
                    base: base,
                    path: outputPath,
                    contents: contents
                });
            }
        }).filter(function(file) {
            return util.isDefined(file);
        }).map(function(file) {
            file.stats = stats;

            return file;
        });
    }

    return files;
}

function processStats(chunk, stats) {
    var files = getFiles(stats);

    if (files.length > 0) {
        files.forEach(function(file) {
            this.push(file);
        }, this);
    } else if (stats.hasErrors() || stats.hasWarnings()) {
        chunk.stats = stats;

        this.push(chunk);
    }
}

function compile(options, callback) {
    if (!util.isObject(options)) { options = {}; }
    if (!util.isFunction(callback)) { callback = function() {}; }

    delete options.watch;

    return through.obj(function(chunk, enc, cb) {
        var compiler = new Compiler(options);

        var result = compiler.run(chunk, function(err, stats) {
            processStats.call(this, chunk, stats);

            if (err) { this.emit('error', wrapError(err)); }

            cb(err);
            callback(err, stats);
        }.bind(this));

        if (!result) {
            cb();
        }
    });
}

function format(options) {
    if (!util.isObject(options)) { options = {}; }

    var cache = [],
        statsOptions = options.verbose === true ? defaults(options, defaultVerboseStatsOptions) : defaults(options, defaultStatsOptions);

    return through.obj(function(chunk, enc, callback) {
        var stats = chunk.stats;

        if (cache && cache.indexOf(stats) < 0) {
            var compilation = stats.compilation,
                filename = path.resolve(compilation.options.file.path);

            cache.push(stats);

            gutil.log('Compiling webpack config', gutil.colors.magenta(tildify(filename)));
            gutil.log('\n' + stats.toString(statsOptions));
        }

        callback(null, chunk);
    }).once('end', function() {
        cache.splice(0, cache.length);
    });
}

function failAfter(options) {
    var cache = [];

    return through.obj(function(chunk, enc, cb) {
        var stats = chunk.stats;

        if (stats && cache.indexOf(stats) < 0) {
            cache.push(stats);
        }

        cb(null, chunk);
    }).once('end', function() {
        var hasErrors = false,
            hasWarnings = false;

        if (options.errors === true) {
            hasErrors = cache.some(function(x) { return x.hasErrors(); });
        }

        if (options.warnings === true) {
            hasWarnings = cache.some(function(x) { return x.hasWarnings(); });
        }

        if (hasErrors || hasWarnings) {
            var err = new Error('Webpack cannot compile config');

            this.emit('error', wrapError(err));
        }

        cache.splice(0, cache.length);
    });
}

var watchers = {};

function watch(filename, options, globOptions, callback) {
    if (!util.isObject(options)) { options = {}; }
    if (util.isFunction(globOptions)) { callback = globOptions; }
    if (!util.isObject(globOptions)) { globOptions = {}; }
    if (!util.isFunction(callback)) { callback = function() {}; }

    options.watch = true;

    var src = WebpackConfig.closest(filename);

    gulp.src(src, globOptions)
        .pipe(through.obj(function(chunk, enc, cb) {
            if (!watchers[chunk.path]) {
                gutil.log('Watching webpack config', gutil.colors.magenta(tildify(src)));

                var compiler = new Compiler(options);

                watchers[chunk.path] = compiler.watch(chunk, function(err, stats) {
                    callback(err, stats);
                });
            }

            cb();
        }));
}

function proxy(err, stats) {
    return through.obj(function(chunk, enc, cb) {
        processStats.call(this, chunk, stats);

        if (err) { this.emit('error', wrapError(err)); }

        cb(err);
    });
}

module.exports = {
    compile: compile,
    format: format,
    failAfter: failAfter,
    watch: watch,
    proxy: proxy,
    core: webpack,
    config: WebpackConfig
};
