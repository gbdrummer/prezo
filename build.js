const path = require('path')
const fs = require('fs-extra')

const ProductionLine = require('productionline-web')
const Chassis = require('@chassis/core')

class CustomProductionLine extends ProductionLine {
  constructor (cfg) {
    super(cfg)
  }

  buildCSS (minify = true, cb) {
    let tasks = new this.TaskRunner()

    this.walk(this.CSS).forEach(filepath => {
      tasks.add(`Process ${this.localDirectory(filepath)}`, next => {
        let chassis = new Chassis({
          minify,
          sourceMap: 2,
          sourceMapPath: path.dirname(this.outputDirectory(filepath)),
          theme: path.resolve(`${this.SOURCE}/css/main.theme`),

          layout: {
            minWidth: 320,
            maxWidth: 1920
          }
        })

        chassis.process(filepath, (err, processed) => {
          if (err) {
            return console.error(err)
          }

          if (processed.sourceMap) {
            this.writeFileSync(`${this.outputDirectory(filepath)}.map`, processed.sourceMap)
          }

          this.writeFile(this.outputDirectory(filepath), processed.css, next)
        })
      })
    })

    tasks.on('complete', cb)
    tasks.run()
  }

  buildJavaScript (transpile = true, minify = true, createsourcemaps = true, cb) {
    if (createsourcemaps && this.PRIVATE.SOURCEMAPURL === null) {
      createsourcemaps = false
    }

    let transpiler = new this.TaskRunner()

    this.walk(this.JAVASCRIPT).forEach(filepath => {
      transpiler.add(`Transpile ${this.localDirectory(filepath)}`, cont => {
        // Handle transpilation
        let transpiled = transpile ? this.transpile(filepath) : { code: fs.readFileSync(filepath), map: null }

        // Sourcemap configuration
        let createmap = createsourcemaps

        if (!createsourcemaps) {
          transpiled.map = null
        } else if (this.PRIVATE.IGNOREDSOURCEMAPS.length > 0) {
          for (let i = 0; i < this.PRIVATE.IGNOREDSOURCEMAPS.length; i++) {
            if (this.minimatch(filepath, path.join(this.SOURCE, this.PRIVATE.IGNOREDSOURCEMAPS[i]))) {
              createmap = false
              transpiled.map = null
              this.warn('     - Skipped sourcemap creation for ' + this.localDirectory(filepath) + ' (EXPLICITLY IGNORED)')
              break
            }
          }
        }

        // Handle minification
        let minified = minify ? this.minify(transpiled.code, this.localDirectory(filepath), transpiled.map) : transpiled

        // Apply comment header & footer
        let content = this.applyHeader(minified.code, 'js')
        content = this.applyFooter(minified.code, 'js')

        // Create sourcemaps
        if (createmap && minified.map !== null) {
          let mappath = path.join(this.sourcemapDirectory(filepath), path.basename(filepath) + '.map')
          this.writeFileSync(mappath, minified.map)
          this.subtle('     + SourceMap created:', this.localDirectory(mappath))
        }

        this.writeFile(this.outputDirectory(filepath), content, cont)
      })
    })

    transpiler.on('complete', cb)
    transpiler.run(true)
  }

  copyWebcomponents (cb) {
    this.walk(this.WEBCOMPONENTS).forEach(filepath => {
      fs.copySync(filepath, this.outputDirectory(filepath))
    })

    cb && cb()
  }

  copyPolyfills (cb) {
    this.walk(this.POLYFILLS).forEach(filepath => {
      fs.copySync(filepath, this.outputDirectory(filepath))
    })

    cb && cb()
  }

  make (dev = false) {
    this.clean()
    this.copyAssets()
    this.addTask('Copy Webcomponents', next => this.copyWebcomponents(next))
    this.addTask('Copy Polyfills', next => this.copyPolyfills(next))
    this.buildHTML()
    this.addTask('Build JavaScript', next => this.buildJavaScript(!dev, !dev, !dev, next))
    this.addTask('Build CSS', next => this.buildCSS(!dev, next))
  }
}

const builder = new CustomProductionLine({
  header: `Copyright (c) ${new Date().getFullYear()} Ecor Ventures LLC.\nVersion ${this.version} built on ${new Date().toString()}`,

  commands: {
    '--prod' (cmd) {
      builder.make()
    },

    '--dev' (cmd) {
      builder.make(true)

      builder.watch((action, filepath) => {
        if (action === 'create' || action === 'update') {
          builder.make(true)
          builder.run()
        }
      })
    }
  }
})

builder.ASSETS = []
builder.CSS = path.join(builder.SOURCE, '/css/**/*.css')
builder.JAVASCRIPT = path.join(builder.SOURCE, '/js/**/*.js')

builder.run()
