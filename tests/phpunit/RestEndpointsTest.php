<?php

use PHPUnit\Framework\TestCase;

final class RestEndpointsTest extends TestCase {
	private $published_post_id = 101;
	private $draft_post_id = 102;

	protected function setUp(): void {
		parent::setUp();
		bibliography_builder_test_reset_state();

		$block_content = '<!-- wp:bibliography-builder/bibliography {} /-->';

		bibliography_builder_test_set_post( $this->published_post_id, 'publish', $block_content );
		bibliography_builder_test_set_post( $this->draft_post_id, 'draft', $block_content );
		bibliography_builder_test_set_parsed_blocks(
			$block_content,
			array(
				array(
					'blockName' => 'bibliography-builder/bibliography',
					'attrs'     => array(
						'citationStyle' => 'chicago-notes-bibliography',
						'headingText'   => 'References',
						'outputJsonLd'  => true,
						'outputCoins'   => false,
						'outputCslJson' => true,
						'citations'     => array(
							array(
								'id'              => 'alpha-1',
								'formattedText'   => '<strong>Alpha</strong> citation.',
								'displayOverride' => '',
								'csl'             => array(
									'type'   => 'book',
									'title'  => 'Alpha Book',
									'author' => array(
										array(
											'family' => 'Alpha',
											'given'  => 'Ada',
										),
									),
								),
							),
						),
					),
				),
			)
		);
	}

	public function test_rest_routes_are_registered(): void {
		bibliography_builder_register_rest_routes();
		$routes = $GLOBALS['bibliography_builder_test_rest_routes'];

		$this->assertCount( 2, $routes );
		$this->assertSame( 'bibliography/v1', $routes[0]['namespace'] );
		$this->assertSame( '/posts/(?P<post_id>\d+)/bibliographies', $routes[0]['route'] );
		$this->assertSame( '/posts/(?P<post_id>\d+)/bibliographies/(?P<index>\d+)', $routes[1]['route'] );
	}

	public function test_published_posts_are_publicly_readable(): void {
		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/101/bibliographies' );
		$request['post_id'] = $this->published_post_id;

		$this->assertTrue( bibliography_builder_rest_permissions_check( $request ) );
	}

	public function test_draft_posts_require_edit_capability(): void {
		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/102/bibliographies' );
		$request['post_id'] = $this->draft_post_id;

		$forbidden = bibliography_builder_rest_permissions_check( $request );
		$this->assertInstanceOf( WP_Error::class, $forbidden );
		$this->assertSame( 403, $forbidden->get_error_data()['status'] );

		bibliography_builder_test_grant_cap( 7, 'edit_post', $this->draft_post_id );
		bibliography_builder_test_set_current_user( 7 );

		$this->assertTrue( bibliography_builder_rest_permissions_check( $request ) );
	}

	public function test_collection_endpoint_returns_bibliography_data(): void {
		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/101/bibliographies' );
		$request['post_id'] = $this->published_post_id;

		$response = bibliography_builder_rest_get_bibliographies( $request );
		$data     = $response->get_data();

		$this->assertSame( $this->published_post_id, $data['postId'] );
		$this->assertCount( 1, $data['bibliographies'] );
		$this->assertSame( 1, $data['bibliographies'][0]['entryCount'] );
		$this->assertSame( 'References', $data['bibliographies'][0]['headingText'] );
	}

	public function test_single_endpoint_supports_json_text_and_csl_json_formats(): void {
		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/101/bibliographies/0' );
		$request['post_id'] = $this->published_post_id;
		$request['index']   = 0;

		$json = bibliography_builder_rest_get_bibliography( $request );
		$this->assertSame( 0, $json->get_data()['index'] );

		$request['format'] = 'text';
		$text              = bibliography_builder_rest_get_bibliography( $request );
		$this->assertSame( "Alpha citation.\n", $text->get_data() );
		$this->assertSame( 'text/plain; charset=utf-8', $text->get_headers()['Content-Type'] );

		$request['format'] = 'csl-json';
		$csl_json          = bibliography_builder_rest_get_bibliography( $request );
		$this->assertSame( 'Alpha Book', $csl_json->get_data()[0]['title'] );
		$this->assertSame(
			'application/vnd.citationstyles.csl+json; charset=utf-8',
			$csl_json->get_headers()['Content-Type']
		);
	}

	public function test_single_endpoint_returns_404_for_missing_index(): void {
		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/101/bibliographies/99' );
		$request['post_id'] = $this->published_post_id;
		$request['index']   = 99;

		$response = bibliography_builder_rest_get_bibliography( $request );

		$this->assertInstanceOf( WP_Error::class, $response );
		$this->assertSame( 404, $response->get_error_data()['status'] );
	}

	public function test_outputJsonLd_defaults_to_true_when_absent_from_attrs(): void {
		$post_id = 201;
		$block_content = '<!-- wp:bibliography-builder/bibliography {} /-->';

		bibliography_builder_test_set_post( $post_id, 'publish', $block_content );
		bibliography_builder_test_set_parsed_blocks(
			$block_content,
			array(
				array(
					'blockName' => 'bibliography-builder/bibliography',
					'attrs'     => array(
						// outputJsonLd intentionally absent — block.json default is true.
						'citations' => array(),
					),
				),
			)
		);

		$request            = new WP_REST_Request( 'GET', '/bibliography/v1/posts/201/bibliographies' );
		$request['post_id'] = $post_id;

		$response = bibliography_builder_rest_get_bibliographies( $request );
		$data     = $response->get_data();

		$this->assertTrue(
			$data['bibliographies'][0]['outputJsonLd'],
			'outputJsonLd must default to true when the attribute is absent from stored block attrs'
		);
	}

	public function test_plain_text_pre_serve_outputs_sanitized_text_only(): void {
		$request = new WP_REST_Request( 'GET', '/bibliography/v1/posts/101/bibliographies/0' );
		$request->set_query_params( array( 'format' => 'text' ) );
		$response = new WP_REST_Response( '<strong>Alpha</strong> citation.', 200 );
		$response->header( 'Content-Type', 'text/plain; charset=utf-8' );
		$server = new WP_REST_Server();

		ob_start();
		$served = bibliography_builder_rest_pre_serve_request( false, $response, $request, $server );
		$output = ob_get_clean();

		$this->assertTrue( $served );
		$this->assertSame( 'Alpha citation.', $output );
		$this->assertSame( 'text/plain; charset=utf-8', $server->sent_headers['Content-Type'] );
	}
}
