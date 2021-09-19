package airqo.serializers;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.springframework.boot.jackson.JsonComponent;
import org.springframework.data.domain.PageImpl;

import java.io.IOException;

@JsonComponent
public class PageSerializer extends JsonSerializer<PageImpl<?>> {

    @Override
    public void serialize(PageImpl page, JsonGenerator jGen, SerializerProvider serializerProvider)
            throws IOException {

        jGen.writeStartObject();
        jGen.writeNumberField("pageNumber", page.getNumber());
        jGen.writeNumberField("pageSize", page.getSize());
        jGen.writeNumberField("elementsOnPage", page.getNumberOfElements());
        jGen.writeBooleanField("isFirstPage", page.isFirst());
        jGen.writeBooleanField("isLastPage", page.isLast());
        jGen.writeBooleanField("hasNextPage", page.hasNext());
        jGen.writeBooleanField("hasPreviousPage", page.hasPrevious());
        jGen.writeNumberField("totalPages", page.getTotalPages());
        jGen.writeNumberField("totalElements", page.getTotalElements());
        jGen.writeNumberField("offset", page.getPageable().getOffset());

        if (page.hasNext())
            jGen.writeNumberField("nextPage", page.nextPageable().getPageNumber());
        if (page.hasPrevious())
            jGen.writeNumberField("previousPage", page.previousPageable().getPageNumber());

        jGen.writeObjectField("content", page.getContent());

        jGen.writeEndObject();
    }

}
