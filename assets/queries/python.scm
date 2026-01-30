(comment) @ignore

(function_definition
  name: (identifier) @signature
  parameters: (parameters) @signature
  body: (block) @ignore)

(class_definition
  name: (identifier) @signature
  body: (block) @ignore)

(call
  function: [
    (identifier) @call_name
    (attribute attribute: (identifier) @call_name)
  ]
  arguments: (argument_list [(string) (integer)] @call_arg_literal)
) @call_site