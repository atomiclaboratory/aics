(line_comment) @ignore
(block_comment) @ignore

(function_item
  name: (identifier) @signature
  parameters: (parameters) @signature
  body: (block) @ignore)

(impl_item
  body: (declaration_list) @ignore)

(call_expression
  function: [(identifier) (field_expression field: (field_identifier))] @call_name
  arguments: (arguments [(string_literal) (integer_literal)] @call_arg_literal)
) @call_site
