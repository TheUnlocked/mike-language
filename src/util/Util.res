module Option = {
    let sequence = (arr: array<option<'a>>): option<array<'a>> => {
        let result = [];
        let break = ref(false);
        let i = ref(0);
        while !break.contents && i.contents < arr->Js.Array2.length {
            switch arr->Js.Array2.unsafe_get(i.contents) {
                | None => break := true
                | Some(x) => let _ = result->Js.Array2.push(x);
            };
            i := i.contents + 1;
        };
        if break.contents {
            Some(result)
        }
        else {
            None
        }
    }
}