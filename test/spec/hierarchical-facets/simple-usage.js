const test = require('tape');

test('hierarchical facets: simple usage', t => {
  const algoliasearch = require('algoliasearch');
  const sinon = require('sinon');
  const isArray = require('lodash/isArray');

  const algoliasearchHelper = require('../../../');

  const appId = 'hierarchical-toggleRefine-appId';
  const apiKey = 'hierarchical-toggleRefine-apiKey';
  const indexName = 'hierarchical-toggleRefine-indexName';

  const client = algoliasearch(appId, apiKey);
  const helper = algoliasearchHelper(client, indexName, {
    hierarchicalFacets: [
      {
        name: 'categories',
        attributes: [
          'categories.lvl0',
          'categories.lvl1',
          'categories.lvl2',
          'categories.lvl3',
        ],
      },
    ],
  });

  helper.toggleRefine('categories', 'beers > IPA > Flying dog');

  const algoliaResponse = {
    results: [
      {
        query: 'a',
        index: indexName,
        hits: [{ objectID: 'one' }],
        nbHits: 3,
        page: 0,
        nbPages: 1,
        hitsPerPage: 20,
        facets: {
          'categories.lvl0': { beers: 3, sales: 3 },
          'categories.lvl1': { 'beers > IPA': 3, 'sales > IPA': 3 },
          'categories.lvl2': {
            'beers > IPA > Flying dog': 3,
            'sales > IPA > Flying dog': 3,
          },
        },
      },
      {
        query: 'a',
        index: indexName,
        hits: [{ objectID: 'one' }],
        nbHits: 1,
        page: 0,
        nbPages: 1,
        hitsPerPage: 1,
        facets: {
          'categories.lvl0': { beers: 9 },
          'categories.lvl1': { 'beers > IPA': 9 },
          'categories.lvl2': {
            'beers > IPA > Flying dog': 3,
            'sales > IPA > Flying dog': 3,
            'beers > IPA > Brewdog punk IPA': 6,
          },
        },
      },
      {
        query: 'a',
        index: indexName,
        hits: [{ objectID: 'one' }],
        nbHits: 1,
        page: 0,
        nbPages: 1,
        hitsPerPage: 1,
        facets: {
          'categories.lvl0': { beers: 20, fruits: 5, sales: 20 },
        },
      },
    ],
  };

  const expectedHelperResponse = [
    {
      name: 'categories',
      count: null,
      isRefined: true,
      path: null,
      data: [
        {
          name: 'beers',
          path: 'beers',
          count: 9,
          isRefined: true,
          data: [
            {
              name: 'IPA',
              path: 'beers > IPA',
              count: 9,
              isRefined: true,
              data: [
                {
                  name: 'Flying dog',
                  path: 'beers > IPA > Flying dog',
                  count: 3,
                  isRefined: true,
                  data: null,
                },
                {
                  name: 'Brewdog punk IPA',
                  path: 'beers > IPA > Brewdog punk IPA',
                  count: 6,
                  isRefined: false,
                  data: null,
                },
              ],
            },
          ],
        },
        {
          name: 'fruits',
          path: 'fruits',
          count: 5,
          isRefined: false,
          data: null,
        },
        {
          name: 'sales',
          path: 'sales',
          count: 20,
          isRefined: false,
          data: null,
        },
      ],
    },
  ];

  client.search = sinon.stub().resolves(algoliaResponse);

  helper.setQuery('a').search();

  helper.once('result', content => {
    const call = client.search.getCall(0);
    const queries = call.args[0];
    const hitsQuery = queries[0];
    const parentValuesQuery = queries[1];
    const rootValuesQuery = queries[2];

    t.equal(queries.length, 3, 'we made three queries');
    t.deepEqual(
      hitsQuery.params.facets,
      [
        'categories.lvl0',
        'categories.lvl1',
        'categories.lvl2',
        'categories.lvl3',
      ],
      'first query (hits) has `categories.lvl0, categories.lvl1, categories.lvl2, categories.lvl3` as facets'
    );
    t.deepEqual(
      hitsQuery.params.facetFilters,
      [['categories.lvl2:beers > IPA > Flying dog']],
      'first query (hits) has our `categories.lvl2` refinement facet filter'
    );
    t.deepEqual(
      parentValuesQuery.params.facets,
      ['categories.lvl0', 'categories.lvl1', 'categories.lvl2'],
      'second query (unrefined parent facet values) has `categories.lvl2` as facets'
    );
    t.deepEqual(
      parentValuesQuery.params.facetFilters,
      [['categories.lvl1:beers > IPA']],
      'second query (unrefined parent facet values) has `categories.lvl1` (parent level) refined'
    );
    t.deepEqual(
      rootValuesQuery.params.facets,
      ['categories.lvl0'],
      'second query (unrefined root facet values) has `categories.lvl0` as facets'
    );
    t.equal(
      rootValuesQuery.params.facetFilters,
      undefined,
      'second query (unrefined root facet values) has no facet refinement'
    );
    t.deepEqual(content.hierarchicalFacets, expectedHelperResponse);
    t.deepEqual(
      content.getFacetByName('categories'),
      expectedHelperResponse[0]
    );

    // we do not yet support multiple values for hierarchicalFacetsRefinements
    // but at some point we may want to open multiple leafs of a hierarchical menu
    // So we set this as an array so that we do not have to bump major to handle it
    t.ok(
      isArray(helper.state.hierarchicalFacetsRefinements.categories),
      'state.hierarchicalFacetsRefinements is an array'
    );
    t.end();
  });
});
