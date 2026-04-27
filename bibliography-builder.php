<?php
/**
 * Plugin Name:       Borges Bibliography Builder
 * Plugin URI:        https://github.com/dknauss/bibliography-builder/
 * Description:       Paste a DOI or BibTeX entry to build a formatted, auto-sorted bibliography in any style.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Tested up to:      7.0
 * Requires PHP:      7.4
 * Author:            Dan Knauss
 * Author URI:        https://dan.knauss.ca/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       bibliography
 * Domain Path:       /languages
 *
 * @package BibliographyBuilder
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Recursively gather bibliography block data from parsed blocks.
 *
 * @param array $blocks Parsed block tree.
 * @param array $results Accumulator.
 * @return array
 */
function bibliography_builder_collect_blocks( $blocks, $results = array() ) {
	foreach ( $blocks as $block ) {
		if ( ! empty( $block['blockName'] ) && 'bibliography-builder/bibliography' === $block['blockName'] ) {
			$attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();

			$results[] = array(
				'citationStyle' => isset( $attrs['citationStyle'] )
					? (string) $attrs['citationStyle']
					: 'chicago-notes-bibliography',
				'headingText'   => isset( $attrs['headingText'] )
					? (string) $attrs['headingText']
					: '',
				'outputJsonLd'  => isset( $attrs['outputJsonLd'] ) ? (bool) $attrs['outputJsonLd'] : true,
				'outputCoins'   => ! empty( $attrs['outputCoins'] ),
				'outputCslJson' => ! empty( $attrs['outputCslJson'] ),
				'citations'     => isset( $attrs['citations'] )
					&& is_array( $attrs['citations'] )
						? array_values(
							array_filter( $attrs['citations'], 'is_array' )
						)
						: array(),
			);
		}

		if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
			$results = bibliography_builder_collect_blocks( $block['innerBlocks'], $results );
		}
	}

	return $results;
}

/**
 * Normalize bibliography API records with index and counts.
 *
 * @param array $bibliographies Raw bibliography arrays.
 * @return array
 */
function bibliography_builder_prepare_bibliographies( $bibliographies ) {
	return array_values(
		array_map(
			static function ( $bibliography, $index ) {
				$bibliography['index']      = $index;
				$bibliography['entryCount'] = count( $bibliography['citations'] );

				return $bibliography;
			},
			$bibliographies,
			array_keys( $bibliographies )
		)
	);
}

/**
 * Get normalized bibliography data for a post.
 *
 * @param WP_Post $post Post object.
 * @return array
 */
function bibliography_builder_get_bibliographies_for_post( $post ) {
	$parsed_blocks  = parse_blocks( (string) $post->post_content );
	$bibliographies = bibliography_builder_collect_blocks( $parsed_blocks );

	return bibliography_builder_prepare_bibliographies( $bibliographies );
}

/**
 * Return the visible display text for a citation record.
 *
 * @param array $citation Citation record.
 * @return string
 */
function bibliography_builder_get_citation_display_text( $citation ) {
	if ( ! empty( $citation['displayOverride'] ) && is_string( $citation['displayOverride'] ) ) {
		return $citation['displayOverride'];
	}

	if ( ! empty( $citation['formattedText'] ) && is_string( $citation['formattedText'] ) ) {
		return $citation['formattedText'];
	}

	if ( ! empty( $citation['csl']['title'] ) && is_string( $citation['csl']['title'] ) ) {
		return $citation['csl']['title'];
	}

	return '';
}

/**
 * Build plain-text bibliography output from stored citation display strings.
 *
 * @param array $bibliography Bibliography record.
 * @return string
 */
function bibliography_builder_build_plain_text( $bibliography ) {
	$lines = array();

	foreach ( $bibliography['citations'] as $citation ) {
		$lines[] = wp_strip_all_tags( bibliography_builder_get_citation_display_text( $citation ), false );
	}

	return implode( "\n", $lines ) . "\n";
}

/**
 * Build a canonical CSL array from bibliography citations.
 *
 * @param array $bibliography Bibliography record.
 * @return array
 */
function bibliography_builder_build_csl_json( $bibliography ) {
	return array_values(
		array_map(
			static function ( $citation ) {
				return isset( $citation['csl'] ) && is_array( $citation['csl'] ) ? $citation['csl'] : array();
			},
			$bibliography['citations']
		)
	);
}

/**
 * Whether the current request may read bibliography data for a post.
 *
 * @param WP_Post $post Post object.
 * @return bool
 */
function bibliography_builder_can_read_post( $post ) {
	$status = get_post_status( $post );

	if ( 'publish' === $status ) {
		return true;
	}

	return current_user_can( 'edit_post', $post->ID );
}

/**
 * REST permission callback for bibliography access.
 *
 * @param WP_REST_Request $request REST request.
 * @return true|WP_Error
 */
function bibliography_builder_rest_permissions_check( WP_REST_Request $request ) {
	$post_id = absint( $request['post_id'] );
	$post    = get_post( $post_id );

	if ( ! $post ) {
		return new WP_Error(
			'bibliography_builder_post_not_found',
			__( 'Post not found.', 'bibliography' ),
			array( 'status' => 404 )
		);
	}

	if ( bibliography_builder_can_read_post( $post ) ) {
		return true;
	}

	return new WP_Error(
		'bibliography_builder_forbidden',
		__( 'Sorry, you are not allowed to read this bibliography.', 'bibliography' ),
		array( 'status' => 403 )
	);
}

/**
 * REST callback returning bibliography block data for a post.
 *
 * @param WP_REST_Request $request REST request.
 * @return WP_REST_Response
 */
function bibliography_builder_rest_get_bibliographies( WP_REST_Request $request ) {
	$post_id        = absint( $request['post_id'] );
	$post           = get_post( $post_id );
	$bibliographies = bibliography_builder_get_bibliographies_for_post( $post );

	return rest_ensure_response(
		array(
			'postId'         => $post_id,
			'bibliographies' => $bibliographies,
		)
	);
}

/**
 * REST callback returning one bibliography block in various formats.
 *
 * @param WP_REST_Request $request REST request.
 * @return WP_REST_Response|WP_Error
 */
function bibliography_builder_rest_get_bibliography( WP_REST_Request $request ) {
	$post_id        = absint( $request['post_id'] );
	$index          = absint( $request['index'] );
	$format         = isset( $request['format'] ) ? (string) $request['format'] : 'json';
	$post           = get_post( $post_id );
	$bibliographies = bibliography_builder_get_bibliographies_for_post( $post );

	if ( ! isset( $bibliographies[ $index ] ) ) {
		return new WP_Error(
			'bibliography_builder_not_found',
			__( 'Bibliography block not found for the requested index.', 'bibliography' ),
			array( 'status' => 404 )
		);
	}

	$bibliography = $bibliographies[ $index ];

	if ( 'text' === $format ) {
		$response = new WP_REST_Response( bibliography_builder_build_plain_text( $bibliography ) );
		$response->header( 'Content-Type', 'text/plain; charset=utf-8' );

		return $response;
	}

	if ( 'csl-json' === $format ) {
		$response = rest_ensure_response( bibliography_builder_build_csl_json( $bibliography ) );
		$response->header( 'Content-Type', 'application/vnd.citationstyles.csl+json; charset=utf-8' );

		return $response;
	}

	return rest_ensure_response( $bibliography );
}

/**
 * Register REST routes.
 */
function bibliography_builder_register_rest_routes() {
	$common_args = array(
		'post_id' => array(
			'description'       => __( 'Post ID to inspect for bibliography blocks.', 'bibliography' ),
			'type'              => 'integer',
			'sanitize_callback' => 'absint',
			'validate_callback' => static function ( $value ) {
				return is_numeric( $value ) && (int) $value > 0;
			},
		),
	);

	register_rest_route(
		'bibliography/v1',
		'/posts/(?P<post_id>\d+)/bibliographies',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'bibliography_builder_rest_get_bibliographies',
			'permission_callback' => 'bibliography_builder_rest_permissions_check',
			'args'                => $common_args,
		)
	);

	register_rest_route(
		'bibliography/v1',
		'/posts/(?P<post_id>\d+)/bibliographies/(?P<index>\d+)',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'bibliography_builder_rest_get_bibliography',
			'permission_callback' => 'bibliography_builder_rest_permissions_check',
			'args'                => array_merge(
				$common_args,
				array(
					'index'  => array(
						'description'       => __(
							'Zero-based bibliography block index within the post.',
							'bibliography'
						),
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value ) && (int) $value >= 0;
						},
					),
					'format' => array(
						'description'       => __(
							'Response format: json, text, or csl-json.',
							'bibliography'
						),
						'type'              => 'string',
						'default'           => 'json',
						'sanitize_callback' => static function ( $value ) {
							return sanitize_key( $value );
						},
						'validate_callback' => static function ( $value ) {
							return in_array(
								$value,
								array( 'json', 'text', 'csl-json' ),
								true
							);
						},
					),
				)
			),
		)
	);
}


/**
 * Serve plain-text bibliography responses without JSON string wrapping.
 *
 * @param bool             $served  Whether the request has already been served.
 * @param WP_HTTP_Response $result  Result to send to the client.
 * @param WP_REST_Request  $request Request used to generate the response.
 * @param WP_REST_Server   $server  Server instance.
 * @return bool
 */
function bibliography_builder_rest_pre_serve_request( $served, $result, $request, $server ) {
	if ( $served ) {
		return $served;
	}

	if ( 0 !== strpos( $request->get_route(), '/bibliography/v1/' ) ) {
		return $served;
	}

	if ( 'text' !== $request->get_param( 'format' ) ) {
		return $served;
	}

	$data = $result->get_data();

	if ( ! is_string( $data ) ) {
		return $served;
	}

	$headers = $result->get_headers();

	foreach ( $headers as $key => $value ) {
		$server->send_header( $key, $value );
	}

	// Plain-text REST response is intentionally stripped to plain text at send time.
	echo wp_strip_all_tags( $data, false ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	return true;
}

/**
 * Register the block.
 */
function bibliography_builder_block_init() {
	register_block_type( __DIR__ );
}
add_action( 'init', 'bibliography_builder_block_init' );
add_action( 'rest_api_init', 'bibliography_builder_register_rest_routes' );
add_filter( 'rest_pre_serve_request', 'bibliography_builder_rest_pre_serve_request', 10, 4 );
