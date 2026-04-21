<?php

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/../../' );
}

$GLOBALS['bibliography_builder_test_posts']           = array();
$GLOBALS['bibliography_builder_test_parsed_blocks']   = array();
$GLOBALS['bibliography_builder_test_current_user_id'] = 0;
$GLOBALS['bibliography_builder_test_user_caps']       = array();
$GLOBALS['bibliography_builder_test_rest_routes']     = array();

function bibliography_builder_test_reset_state() {
	$GLOBALS['bibliography_builder_test_posts']           = array();
	$GLOBALS['bibliography_builder_test_parsed_blocks']   = array();
	$GLOBALS['bibliography_builder_test_current_user_id'] = 0;
	$GLOBALS['bibliography_builder_test_user_caps']       = array();
	$GLOBALS['bibliography_builder_test_rest_routes']     = array();
}

function bibliography_builder_test_set_post( $post_id, $status, $content ) {
	$GLOBALS['bibliography_builder_test_posts'][ $post_id ] = (object) array(
		'ID'           => $post_id,
		'post_status'  => $status,
		'post_content' => $content,
	);
}

function bibliography_builder_test_set_parsed_blocks( $content, $blocks ) {
	$GLOBALS['bibliography_builder_test_parsed_blocks'][ $content ] = $blocks;
}

function bibliography_builder_test_grant_cap( $user_id, $capability, $object_id ) {
	$GLOBALS['bibliography_builder_test_user_caps'][ $user_id ][ $capability ][ $object_id ] = true;
}

function bibliography_builder_test_set_current_user( $user_id ) {
	$GLOBALS['bibliography_builder_test_current_user_id'] = $user_id;
}

function add_action() {}

function add_filter() {}

function register_block_type() {}

function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['bibliography_builder_test_rest_routes'][] = array(
		'namespace' => $namespace,
		'route'     => $route,
		'args'      => $args,
	);
}

function parse_blocks( $content ) {
	return $GLOBALS['bibliography_builder_test_parsed_blocks'][ $content ] ?? array();
}

function get_post( $post_id ) {
	return $GLOBALS['bibliography_builder_test_posts'][ $post_id ] ?? null;
}

function get_post_status( $post ) {
	return is_object( $post ) ? $post->post_status : null;
}

function current_user_can( $capability, $object_id = 0 ) {
	$user_id = $GLOBALS['bibliography_builder_test_current_user_id'];
	return ! empty( $GLOBALS['bibliography_builder_test_user_caps'][ $user_id ][ $capability ][ $object_id ] );
}

function absint( $value ) {
	return abs( (int) $value );
}

function sanitize_key( $value ) {
	return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $value ) );
}

function __( $text ) {
	return $text;
}

function wp_strip_all_tags( $text ) {
	return strip_tags( (string) $text );
}

function rest_ensure_response( $response ) {
	if ( $response instanceof WP_REST_Response ) {
		return $response;
	}

	return new WP_REST_Response( $response, 200 );
}

class WP_Error {
	public $errors = array();
	public $error_data = array();

	public function __construct( $code = '', $message = '', $data = null ) {
		if ( $code ) {
			$this->errors[ $code ]   = array( $message );
			$this->error_data[ $code ] = $data;
		}
	}

	public function get_error_code() {
		return array_key_first( $this->errors );
	}

	public function get_error_message() {
		$code = $this->get_error_code();
		return $code ? $this->errors[ $code ][0] : '';
	}

	public function get_error_data() {
		$code = $this->get_error_code();
		return $code ? $this->error_data[ $code ] : null;
	}
}

class WP_REST_Request implements ArrayAccess {
	private $method;
	private $route;
	private $params = array();

	public function __construct( $method = 'GET', $route = '/' ) {
		$this->method = $method;
		$this->route  = $route;
	}

	public function set_query_params( $params ) {
		$this->params = array_merge( $this->params, $params );
	}

	public function get_param( $key ) {
		return $this->params[ $key ] ?? null;
	}

	public function get_route() {
		return $this->route;
	}

	public function offsetExists( $offset ): bool {
		return isset( $this->params[ $offset ] );
	}

	#[\ReturnTypeWillChange]
	public function offsetGet( $offset ) {
		return $this->params[ $offset ] ?? null;
	}

	public function offsetSet( $offset, $value ): void {
		$this->params[ $offset ] = $value;
	}

	public function offsetUnset( $offset ): void {
		unset( $this->params[ $offset ] );
	}
}

class WP_REST_Response {
	private $data;
	private $status;
	private $headers = array();

	public function __construct( $data = null, $status = 200 ) {
		$this->data   = $data;
		$this->status = $status;
	}

	public function get_data() {
		return $this->data;
	}

	public function get_status() {
		return $this->status;
	}

	public function header( $key, $value ) {
		$this->headers[ $key ] = $value;
	}

	public function get_headers() {
		return $this->headers;
	}
}

class WP_REST_Server {
	const READABLE = 'GET';

	public $sent_headers = array();

	public function send_header( $key, $value ) {
		$this->sent_headers[ $key ] = $value;
	}
}

require_once dirname( __DIR__, 2 ) . '/bibliography-builder.php';
