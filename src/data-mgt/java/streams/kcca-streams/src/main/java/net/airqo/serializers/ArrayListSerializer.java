package net.airqo.serializers;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.header.Headers;
import org.apache.kafka.common.serialization.Serializer;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class ArrayListSerializer<T> implements Serializer<ArrayList<T>> {

    private Serializer<T> inner;

    public ArrayListSerializer(Serializer<T> inner) {
        this.inner = inner;
    }

    public ArrayListSerializer() {}

    @Override
    public void configure(Map<String, ?> configs, boolean isKey) {

    }

    @Override
    public byte[] serialize(String s, ArrayList<T> ts) {

        final ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        final DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        final Iterator<T> iterator = ts.iterator();
        try {
            dataOutputStream.writeInt(ts.size());
            while (iterator.hasNext()) {
                final byte[] bytes = inner.serialize(s, iterator.next());
                dataOutputStream.writeInt(bytes.length);
                dataOutputStream.write(bytes);
            }
        } catch (IOException e) {
            throw new RuntimeException("Unable to serialize ArrayList", e);
        }
        return byteArrayOutputStream.toByteArray();

    }

    @Override
    public byte[] serialize(String topic, Headers headers, ArrayList<T> data) {
        return new byte[0];
    }

    @Override
    public void close() {
        inner.close();
    }
}
