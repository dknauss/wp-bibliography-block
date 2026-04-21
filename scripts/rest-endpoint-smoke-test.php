<?php
if ( ! defined( 'ABSPATH' ) ) {
	require_once dirname( __DIR__, 3 ) . '/wp-load.php';
}

function bibliography_builder_test_assert( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "Assertion failed: {$message}\n" );
		exit( 1 );
	}
}

function bibliography_builder_test_request( $route ) {
	$parts    = wp_parse_url( $route );
	$path     = isset( $parts['path'] ) ? $parts['path'] : $route;
	$request  = new WP_REST_Request( 'GET', $path );

	if ( ! empty( $parts['query'] ) ) {
		parse_str( $parts['query'], $query_params );
		$request->set_query_params( $query_params );
	}

	$response = rest_do_request( $request );

	return $response;
}

$attrs = array(
	'citationStyle' => 'chicago-notes-bibliography',
	'headingText'   => 'References',
	'outputJsonLd'  => true,
	'outputCoins'   => false,
	'outputCslJson' => false,
	'citations'     => array(
		array(
			'id'            => 'alpha-1',
			'formattedText' => '<strong>Alpha</strong> citation.',
			'csl'           => array(
				'type'   => 'book',
				'title'  => 'Alpha Book',
				'author' => array(
					array(
						'family' => 'Alpha',
						'given'  => 'Ada',
					),
				),
				'issued' => array(
					'date-parts' => array( array( 2024 ) ),
				),
			),
		),
	),
);

$block_content = sprintf(
	'<!-- wp:bibliography-builder/bibliography %s /-->',
	wp_json_encode( $attrs )
);

$published_post_id = 0;
$draft_post_id     = 0;

try {
	$published_post_id = wp_insert_post(
		array(
			'post_title'   => 'REST Bibliography Smoke Published',
			'post_status'  => 'publish',
			'post_type'    => 'post',
			'post_content' => $block_content,
		),
		true
	);
	bibliography_builder_test_assert( ! is_wp_error( $published_post_id ), 'Could not create published smoke post.' );

	$draft_post_id = wp_insert_post(
		array(
			'post_title'   => 'REST Bibliography Smoke Draft',
			'post_status'  => 'draft',
			'post_type'    => 'post',
			'post_content' => $block_content,
		),
		true
	);
	bibliography_builder_test_assert( ! is_wp_error( $draft_post_id ), 'Could not create draft smoke post.' );

	wp_set_current_user( 0 );

	$collection = bibliography_builder_test_request( "/bibliography/v1/posts/{$published_post_id}/bibliographies" );
	bibliography_builder_test_assert( 200 === $collection->get_status(), 'Published collection route should return 200.' );
	$collection_data = $collection->get_data();
	bibliography_builder_test_assert( $published_post_id === $collection_data['postId'], 'Collection route should return matching postId.' );
	bibliography_builder_test_assert( 1 === count( $collection_data['bibliographies'] ), 'Collection route should return one bibliography.' );

	$single = bibliography_builder_test_request( "/bibliography/v1/posts/{$published_post_id}/bibliographies/0" );
	bibliography_builder_test_assert( 200 === $single->get_status(), 'Single bibliography route should return 200.' );
	$single_data = $single->get_data();
	bibliography_builder_test_assert( 0 === $single_data['index'], 'Single bibliography route should return requested index.' );
	bibliography_builder_test_assert( 1 === $single_data['entryCount'], 'Single bibliography route should return entry count.' );

	$text = bibliography_builder_test_request( "/bibliography/v1/posts/{$published_post_id}/bibliographies/0?format=text" );
	bibliography_builder_test_assert( 200 === $text->get_status(), 'Plain-text format should return 200.' );
	bibliography_builder_test_assert( "Alpha citation.\n" === $text->get_data(), 'Plain-text format should return sanitized plain citation text.' );

	$csl_json = bibliography_builder_test_request( "/bibliography/v1/posts/{$published_post_id}/bibliographies/0?format=csl-json" );
	bibliography_builder_test_assert( 200 === $csl_json->get_status(), 'CSL-JSON format should return 200.' );
	$csl_json_data = $csl_json->get_data();
	bibliography_builder_test_assert( 'Alpha Book' === $csl_json_data[0]['title'], 'CSL-JSON format should return citation metadata.' );

	$missing = bibliography_builder_test_request( "/bibliography/v1/posts/{$published_post_id}/bibliographies/99" );
	bibliography_builder_test_assert( 404 === $missing->get_status(), 'Missing bibliography index should return 404.' );

	$forbidden = bibliography_builder_test_request( "/bibliography/v1/posts/{$draft_post_id}/bibliographies" );
	bibliography_builder_test_assert( 403 === $forbidden->get_status(), 'Draft collection route should be forbidden for anonymous users.' );

	wp_set_current_user( 1 );
	$draft_allowed = bibliography_builder_test_request( "/bibliography/v1/posts/{$draft_post_id}/bibliographies" );
	bibliography_builder_test_assert( 200 === $draft_allowed->get_status(), 'Draft collection route should be allowed for editors.' );

	fwrite( STDOUT, "REST endpoint smoke tests passed.\n" );
} finally {
	if ( $published_post_id ) {
		wp_delete_post( $published_post_id, true );
	}
	if ( $draft_post_id ) {
		wp_delete_post( $draft_post_id, true );
	}
	wp_set_current_user( 0 );
}
