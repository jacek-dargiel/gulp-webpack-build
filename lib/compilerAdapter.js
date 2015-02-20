'use strict';

var path = require('path'),
    webpack = require('webpack'),
    ProgressPlugin = require('webpack/lib/ProgressPlugin'),
    WebpackConfig = require('webpack-config'),
    MemoryFs = require('memory-fs'),
    util = require('./util');

var compilers = {};

function CompilerAdapter(webpackOptions, сompilerOptions) {
    if (!util.isObject(webpackOptions)) { webpackOptions = {}; }
    if (!util.isObject(сompilerOptions)) { сompilerOptions = {}; }

    this.webpackOptions = webpackOptions;
    this.сompilerOptions = сompilerOptions;
}

CompilerAdapter.prototype.getCompiler = function(file) {
    var filename = path.resolve(file.path);

    return compilers[filename];
};

CompilerAdapter.prototype.setCompiler = function(file, compiler) {
    var filename = path.resolve(file.path);

    compilers[filename] = compiler;

    return compiler;
};

CompilerAdapter.prototype.configFor = function(file) {
    var filename = path.resolve(file.path),
        config = WebpackConfig.fromFile(filename, false);

    config.merge(this.webpackOptions);

    config.config = {
        filename: filename
    };

    var hasOutputPath = config.output && util.isDefined(config.output.path);

    if (!hasOutputPath) {
        config.merge({
            output: {
                path: path.dirname(filename)
            }
        });
    }

    return config;
};

CompilerAdapter.prototype.createCompiler = function(file) {
    var config = this.configFor(file),
        compiler = config && webpack(config);

    if (compiler) {
        var useMemoryFs = this.сompilerOptions.useMemoryFs === true,
            withProgress = util.isFunction(this.сompilerOptions.progress);

        if (useMemoryFs) {
            compiler.outputFileSystem = new MemoryFs();
        }

        if (withProgress) {
            var progress = this.сompilerOptions.progress;

            compiler.apply(new ProgressPlugin(function(p, msg) {
                progress.call(compiler, p, msg);
            }));
        }
    }

    return compiler;
};

CompilerAdapter.prototype.compilerFor = function(file) {
    var compiler = this.getCompiler(file);

    if (!compiler) {
        compiler = this.createCompiler(file);

        if (compiler) {
            this.setCompiler(file, compiler);
        }
    }

    return compiler;
};

CompilerAdapter.prototype.run = function(file, callback) {
    if (!util.isFunction(callback)) { callback = function() {}; }

    var compiler = this.compilerFor(file);

    if (compiler) {
        compiler.run(callback);
    }

    return compiler;
};

CompilerAdapter.prototype.watch = function(file, callback) {
    if (!util.isFunction(callback)) { callback = function() {}; }

    var compiler = this.compilerFor(file),
        watcher;

    if (compiler) {
        var watchDelay = compiler.options.watchDelay || 200;

        watcher = compiler.watcher;

        if (watcher) {
            watcher.close(function() {});

            compiler = this.createCompiler(file);
        }

        watcher = compiler.watch(watchDelay, callback);

        if (watcher) {
            compiler.watcher = watcher;

            this.setCompiler(file, compiler);
        }
    }

    return watcher;
};

module.exports = CompilerAdapter;