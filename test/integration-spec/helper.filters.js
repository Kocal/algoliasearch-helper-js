const utils = require('../integration-utils.js');
const setup = utils.setup;

const algoliasearchHelper = utils.isCIBrowser
  ? window.algoliasearchHelper
  : require('../../');

let test = require('tape');
const bind = require('lodash/bind');
const random = require('lodash/random');

if (!utils.shouldRun) {
  test = test.skip;
}

test('[INT][FILTERS] Should retrieve different values for multi facetted records', t => {
  const indexName = `_travis-algoliasearch-helper-js-${process.env
    .TRAVIS_BUILD_NUMBER || 'DEV'}helper_refinements${random(0, 5000)}`;

  setup(indexName, (client, index) =>
    index
      .addObjects([
        { facet: ['f1', 'f2'] },
        { facet: ['f1', 'f3'] },
        { facet: ['f2', 'f3'] },
      ])
      .then(() =>
        index.setSettings({
          attributesToIndex: ['facet'],
          attributesForFaceting: ['facet'],
        })
      )
      .then(content => index.waitTask(content.taskID))
      .then(() => client)
  )
    .then(client => {
      const helper = algoliasearchHelper(client, indexName, {
        facets: ['facet'],
      });

      let calls = 0;
      helper.on('error', err => {
        t.fail(err);
        t.end();
      });
      helper.on('result', content => {
        calls++;

        if (calls === 1) {
          t.equal(content.hits.length, 2, 'filter should result in two items');
          t.deepEqual(content.facets[0].data, {
            f1: 2,
            f2: 1,
            f3: 1,
          });

          helper.addRefine('facet', 'f2').search();
        }

        if (calls === 2) {
          t.equal(content.hits.length, 1, 'filter should result in one item');
          t.deepEqual(content.facets[0].data, {
            f1: 1,
            f2: 1,
          });
          helper.toggleRefine('facet', 'f3').search();
        }

        if (calls === 3) {
          t.equal(content.hits.length, 0, 'filter should result in 0 item');
          t.equal(content.facets[0], undefined);
          helper.removeRefine('facet', 'f2').search();
        }

        if (calls === 4) {
          t.equal(
            content.hits.length,
            1,
            'filter should result in one item again'
          );
          t.deepEqual(content.facets[0].data, {
            f1: 1,
            f3: 1,
          });
          client.deleteIndex(indexName);
          if (!process.browser) {
            client.destroy();
          }
          t.end();
        }
      });

      helper.addRefine('facet', 'f1').search();
    })
    .then(null, bind(t.error, t));
});
